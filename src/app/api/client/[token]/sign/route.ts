import { NextResponse } from "next/server"

import { generateSignedContractArtifact } from "@/features/contracts/server/contract-artifacts"
import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    const link = await prisma.transactionLink.findUnique({
      where: { id: linkContext.link.id },
      include: { transaction: { include: { clientProfile: true } } },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const body = await request.json()

    const signatureDataUrl: unknown = body.signatureDataUrl
    const signedTimezone: string | null =
      typeof body.signedTimezone === "string" ? body.signedTimezone : null
    const signatureMethod: string =
      typeof body.signatureMethod === "string" ? body.signatureMethod : "draw"
    const typedValue: string | null =
      typeof body.typedValue === "string" ? body.typedValue.slice(0, 500) : null
    const fontKey: string | null =
      typeof body.fontKey === "string" ? body.fontKey.slice(0, 100) : null

    if (
      !signatureDataUrl ||
      typeof signatureDataUrl !== "string" ||
      !signatureDataUrl.startsWith("data:image/")
    ) {
      return NextResponse.json(
        { success: false, message: "A valid signature image is required." },
        { status: 400 }
      )
    }

    const methodLabel =
      signatureMethod === "type"
        ? "Typed Signature"
        : signatureMethod === "upload"
          ? "Uploaded Signature"
          : "Canvas Signature"

    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null

    const transactionId = link.transaction.id
    const vendorId = link.transaction.vendorId
    const signerName = link.transaction.clientProfile?.fullName || "Unknown"
    const signerEmail = link.transaction.clientProfile?.email || "Unknown"
    const signedAt = new Date()
    const existingSignature = await prisma.signatureRecord.findUnique({
      where: { transactionId },
    })
    const preparedSignatureStatus = existingSignature?.status === "SIGNED" ? "SIGNED" : "PENDING"

    // Run each write independently — no interactive transaction so large
    // base64 payloads don't hit the 5 s connection-hold timeout.
    // All ops are idempotent (upsert / dedupeKey) so retries are safe.

    await markTransactionLinkOpened(prisma, {
      linkId: link.id,
      transactionId,
    })

    await prisma.signatureRecord.upsert({
      where: { transactionId },
      update: {
        status: preparedSignatureStatus,
        signerName,
        signerEmail,
        method: methodLabel,
        signatureDataUrl,
        typedValue,
        fontKey,
        ipAddress,
        signedAt,
      },
      create: {
        transactionId,
        status: preparedSignatureStatus,
        signerName,
        signerEmail,
        method: methodLabel,
        signatureDataUrl,
        typedValue,
        fontKey,
        ipAddress,
        signedAt,
      },
    })

    const artifact = await generateSignedContractArtifact(prisma, {
      transactionId,
      signatureDataUrl,
      signedTimezone,
    })

    if (!artifact?.signedPdfUrl) {
      throw new Error("Signed contract artifact was not generated.")
    }

    await prisma.signatureRecord.update({
      where: { transactionId },
      data: {
        status: "SIGNED",
        signerName,
        signerEmail,
        method: methodLabel,
        signatureDataUrl,
        typedValue,
        fontKey,
        ipAddress,
        signedAt,
      },
    })

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "SIGNED" },
    })

    const signatureEventMeta = {
      signatureMethod,
      methodLabel,
      ...(signatureMethod === "type" && typedValue ? { typedValue } : null),
      ...(signatureMethod === "type" && fontKey ? { fontKey } : null),
    }

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "SIGNATURE_COMPLETED",
      title: "Agreement signed",
      detail: `${signerName} confirmed the agreement via ${methodLabel}.`,
      metadata: signatureEventMeta,
      occurredAt: signedAt,
      dedupeKey: `event:signature:${transactionId}`,
    })

    if (existingSignature?.status !== "SIGNED") {
      await incrementVendorSubscriptionUsage(prisma, vendorId, "eSignaturesUsed")
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextStep = getNextClientStep(transaction)

    if (nextStep === "complete") {
      await completeTransactionWithoutPayment(prisma, transactionId)
    }

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Signature Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save signature" }, { status: 500 })
  }
}
