import { NextResponse } from "next/server"

import { generateSignedContractArtifact } from "@/features/contracts/server/contract-artifacts"
import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

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

    const { signatureDataUrl, signedTimezone } = await request.json()

    if (
      !signatureDataUrl ||
      typeof signatureDataUrl !== "string" ||
      !signatureDataUrl.startsWith("data:image/png;base64,")
    ) {
      return NextResponse.json({ success: false, message: "A drawn signature is required." }, { status: 400 })
    }

    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null

    const transactionId = link.transaction.id
    const vendorId = link.transaction.vendorId
    const signerName = link.transaction.clientProfile?.fullName || "Unknown"
    const signerEmail = link.transaction.clientProfile?.email || "Unknown"
    const existingSignature = await prisma.signatureRecord.findUnique({
      where: { transactionId },
    })

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
        status: "SIGNED",
        signerName,
        signerEmail,
        method: "Canvas Signature",
        signatureDataUrl,
        ipAddress,
        signedAt: new Date(),
      },
      create: {
        transactionId,
        status: "SIGNED",
        signerName,
        signerEmail,
        method: "Canvas Signature",
        signatureDataUrl,
        ipAddress,
        signedAt: new Date(),
      },
    })

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "SIGNED" },
    })

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "SIGNATURE_COMPLETED",
      title: "Agreement signed",
      detail: `${signerName} confirmed the agreement.`,
      dedupeKey: `event:signature:${transactionId}`,
    })

    if (!existingSignature) {
      await incrementVendorSubscriptionUsage(prisma, vendorId, "eSignaturesUsed")
    }

    await generateSignedContractArtifact(prisma, {
      transactionId,
      signatureDataUrl,
      signedTimezone: typeof signedTimezone === "string" ? signedTimezone : null,
    })

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
