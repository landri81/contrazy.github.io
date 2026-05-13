import crypto from "crypto"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { resend } from "@/lib/integrations/resend"

export const runtime = "nodejs"

const TOLERANCE_SECONDS = 300 // reject events older than 5 minutes

function verifyResendSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): boolean {
  // Reject stale events
  const ts = parseInt(svixTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) {
    return false
  }

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret
  const keyBuffer = Buffer.from(rawSecret, "base64")
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const hmac = crypto.createHmac("sha256", keyBuffer)
  hmac.update(signedContent)
  const expectedSig = hmac.digest("base64")

  // svix-signature is space-separated: "v1,BASE64 v1,BASE64"
  for (const part of svixSignature.split(" ")) {
    const [scheme, sig] = part.split(",")
    if (scheme === "v1" && sig === expectedSig) {
      return true
    }
  }
  return false
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

type ReceivedEmailAttachment = {
  id: string
  filename?: string | null
  content_type?: string | null
  content_id?: string | null
}

type RetrievedReceivedEmail = {
  id: string
  from?: string | null
  to?: string[] | null
  cc?: string[] | null
  bcc?: string[] | null
  reply_to?: string[] | null
  subject?: string | null
  html?: string | null
  text?: string | null
  headers?: Record<string, string> | null
  message_id?: string | null
  raw?: {
    download_url?: string | null
    expires_at?: string | null
  } | null
  attachments?: ReceivedEmailAttachment[] | null
  created_at?: string | null
}

type ForwardAttachment = {
  filename?: string | false
  path: string
  contentType?: string
  contentId?: string
}

function getResendErrorMessage(error: unknown) {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return String(error)
}

function buildTextFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

async function retrieveInboundEmail(emailId: string) {
  const { data, error } = await resend.emails.receiving.get(emailId)
  const message = getResendErrorMessage(error)

  if (message || !data) {
    throw new Error(message ?? "Unable to retrieve received email from Resend.")
  }

  return data as RetrievedReceivedEmail
}

async function getForwardableAttachments(email: RetrievedReceivedEmail) {
  const attachments = email.attachments ?? []
  const forwardAttachments: ForwardAttachment[] = []
  const attachmentLinks: Array<{
    filename: string
    downloadUrl: string
    expiresAt: string | null
  }> = []

  for (const attachment of attachments) {
    if (!attachment.id) continue

    const { data, error } = await resend.emails.receiving.attachments.get({
      emailId: email.id,
      id: attachment.id,
    })

    if (error || !data?.download_url) {
      continue
    }

    const filename = data.filename ?? attachment.filename ?? "attachment"

    attachmentLinks.push({
      filename,
      downloadUrl: data.download_url,
      expiresAt: data.expires_at ?? null,
    })

    forwardAttachments.push({
      filename,
      path: data.download_url,
      ...(data.content_type ? { contentType: data.content_type } : {}),
      ...(data.content_id ? { contentId: data.content_id } : {}),
    })
  }

  return { forwardAttachments, attachmentLinks }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const svixId = request.headers.get("svix-id") ?? ""
  const svixTs = request.headers.get("svix-timestamp") ?? ""
  const svixSig = request.headers.get("svix-signature") ?? ""

  if (!svixId || !svixTs || !svixSig) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 })
  }

  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const valid = verifyResendSignature(rawBody, svixId, svixTs, svixSig, env.RESEND_WEBHOOK_SECRET)
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = typeof payload.type === "string" ? payload.type : ""

  // Only act on inbound email events; silently acknowledge everything else
  if (eventType !== "email.received") {
    return NextResponse.json({ ok: true, message: "Ignored" })
  }

  // Idempotency: create the event record first; unique constraint rejects duplicates
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "resend_inbound",
        providerEventId: svixId,
        eventType,
        status: "RECEIVED",
        payload: payload as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Unique constraint violation = already processed — acknowledge and exit
    return NextResponse.json({ ok: true, message: "Already processed" })
  }

  const forwardTo = env.RESEND_INBOUND_FORWARD_TO

  if (!forwardTo) {
    await prisma.webhookEvent
      .update({
        where: { provider_providerEventId: { provider: "resend_inbound", providerEventId: svixId } },
        data: { status: "FAILED", error: "RESEND_INBOUND_FORWARD_TO not configured" },
      })
      .catch(() => {})
    return NextResponse.json({ ok: false, error: "Forward address not configured" }, { status: 500 })
  }

  try {
    const data = (payload.data ?? {}) as Record<string, unknown>
    const emailId = typeof data.email_id === "string" ? data.email_id : null

    if (!emailId) {
      throw new Error("Resend inbound payload is missing data.email_id.")
    }

    const receivedEmail = await retrieveInboundEmail(emailId)
    const from = receivedEmail.from ?? String(data.from ?? "unknown")
    const subject = receivedEmail.subject ?? String(data.subject ?? "(no subject)")
    const toList =
      Array.isArray(receivedEmail.to) && receivedEmail.to.length > 0
        ? receivedEmail.to.join(", ")
        : Array.isArray(data.to)
          ? (data.to as string[]).join(", ")
          : String(data.to ?? "")
    const ccList =
      Array.isArray(receivedEmail.cc) && receivedEmail.cc.length > 0
        ? receivedEmail.cc.join(", ")
        : Array.isArray(data.cc) && (data.cc as string[]).length > 0
          ? (data.cc as string[]).join(", ")
          : null
    const receivedAt = receivedEmail.created_at ?? String(data.created_at ?? new Date().toISOString())
    const messageId = receivedEmail.message_id ?? String(data.message_id ?? "")
    const originalHtml =
      typeof receivedEmail.html === "string" && receivedEmail.html.length > 0
        ? receivedEmail.html
        : `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.6">${escapeHtml(receivedEmail.text ?? "")}</pre>`
    const originalText =
      typeof receivedEmail.text === "string" && receivedEmail.text.length > 0
        ? receivedEmail.text
        : typeof receivedEmail.html === "string"
          ? buildTextFromHtml(receivedEmail.html)
          : ""
    const { forwardAttachments, attachmentLinks } = await getForwardableAttachments(receivedEmail)
    const attachmentListHtml =
      attachmentLinks.length > 0
        ? `
    <tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">Attachments</td><td style="padding:6px 0">
      ${attachmentLinks
        .map(
          (attachment) =>
            `<div><a href="${escapeHtml(attachment.downloadUrl)}" target="_blank" rel="noreferrer">${escapeHtml(attachment.filename)}</a>${
              attachment.expiresAt ? ` <span style="color:#999;font-size:11px">(link expires ${escapeHtml(attachment.expiresAt)})</span>` : ""
            }</div>`
        )
        .join("")}
    </td></tr>`
        : ""
    const rawLinkHtml = receivedEmail.raw?.download_url
      ? `<div style="margin-top:12px;font-size:12px;color:#666">Raw original email: <a href="${escapeHtml(receivedEmail.raw.download_url)}" target="_blank" rel="noreferrer">download .eml</a>${
          receivedEmail.raw.expires_at ? ` <span style="color:#999">(expires ${escapeHtml(receivedEmail.raw.expires_at)})</span>` : ""
        }</div>`
      : ""
    const html = `
<div style="font-family:sans-serif;font-size:14px;color:#333;max-width:600px">
  <div style="background:#f5f5f5;border-left:4px solid #0ea5e9;padding:16px 20px;border-radius:4px;margin-bottom:20px">
    <p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px">Forwarded inbound email received at ${escapeHtml(toList)}</p>
    <p style="margin:0;font-size:18px;font-weight:600">${escapeHtml(subject)}</p>
  </div>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">From</td><td style="padding:6px 0"><strong>${escapeHtml(from)}</strong></td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">To</td><td style="padding:6px 0">${escapeHtml(toList)}</td></tr>
    ${ccList ? `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">CC</td><td style="padding:6px 0">${escapeHtml(ccList)}</td></tr>` : ""}
    <tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">Received</td><td style="padding:6px 0">${escapeHtml(receivedAt)}</td></tr>
    <tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">Resend Email ID</td><td style="padding:6px 0;font-size:11px;color:#aaa">${escapeHtml(emailId)}</td></tr>
    ${messageId ? `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap">Message-ID</td><td style="padding:6px 0;font-size:11px;color:#aaa">${escapeHtml(messageId)}</td></tr>` : ""}
    ${attachmentListHtml}
  </table>
  ${rawLinkHtml}
  <div style="margin:24px 0 12px 0;border-top:1px solid #ddd;padding-top:16px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px">
    Original email content
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;overflow:auto">${originalHtml}</div>
</div>`

    const attachmentText =
      attachmentLinks.length > 0
        ? `\nAttachments:\n${attachmentLinks
            .map((attachment) => `- ${attachment.filename}: ${attachment.downloadUrl}`)
            .join("\n")}\n`
        : ""
    const rawText = receivedEmail.raw?.download_url ? `\nRaw original email: ${receivedEmail.raw.download_url}\n` : ""
    const text = `Forwarded inbound email received at ${toList}

From: ${from}
To: ${toList}${ccList ? `\nCC: ${ccList}` : ""}
Received: ${receivedAt}
Subject: ${subject}
Resend Email ID: ${emailId}
${messageId ? `Message-ID: ${messageId}\n` : ""}${attachmentText}${rawText}
Original email content:

${originalText}`

    const baseEmail = {
      from: env.RESEND_FROM_EMAIL,
      to: forwardTo,
      ...(env.RESEND_AUDIT_BCC_EMAIL ? { bcc: [env.RESEND_AUDIT_BCC_EMAIL] } : {}),
      subject: `Inbound: ${subject} [from: ${from}]`,
      html,
      text,
      replyTo: from,
      ...(messageId ? { headers: { "X-Original-Message-ID": messageId } } : {}),
    }

    const sendResult = await resend.emails.send({
      ...baseEmail,
      ...(forwardAttachments.length > 0 ? { attachments: forwardAttachments } : {}),
    })
    const sendError = getResendErrorMessage(sendResult.error)

    if (sendError && forwardAttachments.length > 0) {
      const retryResult = await resend.emails.send(baseEmail)
      const retryError = getResendErrorMessage(retryResult.error)
      if (retryError) {
        throw new Error(retryError)
      }
    } else if (sendError) {
      throw new Error(sendError)
    }

    await prisma.webhookEvent.update({
      where: { provider_providerEventId: { provider: "resend_inbound", providerEventId: svixId } },
      data: { status: "PROCESSED" },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Resend inbound webhook forward error:", error)

    await prisma.webhookEvent
      .update({
        where: { provider_providerEventId: { provider: "resend_inbound", providerEventId: svixId } },
        data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
      })
      .catch(() => {})

    return NextResponse.json({ ok: false, error: "Failed to forward email" }, { status: 500 })
  }
}
