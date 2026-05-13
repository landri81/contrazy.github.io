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
    const from = String(data.from ?? "unknown")
    const subject = String(data.subject ?? "(no subject)")
    const htmlBody = String(data.html ?? data.text ?? "")
    const textBody = String(data.text ?? "")

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: forwardTo,
      ...(env.RESEND_AUDIT_BCC_EMAIL ? { bcc: [env.RESEND_AUDIT_BCC_EMAIL] } : {}),
      subject: `FWD: ${subject} [from: ${from}]`,
      html: `<p><strong>Forwarded from:</strong> ${escapeHtml(from)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><hr />${htmlBody}`,
      text: `Forwarded from: ${from}\nSubject: ${subject}\n---\n${textBody}`,
    })

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
