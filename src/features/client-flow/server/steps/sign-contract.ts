import { generateSignedContractArtifact } from "@/features/contracts/server/contract-artifacts"
import {
  canRevisitClientStep,
  clientFlowTransactionInclude,
  getNextClientStep,
} from "@/features/client-flow/server/client-flow-data"
import type { ClientStepResult } from "@/features/client-flow/server/steps/submit-documents"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

/**
 * The signature step (shared, M10): the signature image (drawn, or the typed name drawn in a font), the city of
 * signature and the signer's IP; the signed PDF is generated, the event recorded and the e-signature counted once.
 * Contrazy's page and the partner API's embedded checkout call it.
 */

export type ClientSignatureInput = {
  signatureDataUrl: unknown
  signedTimezone: string | null
  signatureMethod: string
  typedValue: string | null
  fontKey: string | null
  signatureCity: string | null
}

export async function signClientContract(linkId: string, input: ClientSignatureInput, ipAddress: string | null): Promise<ClientStepResult> {
  const link = await prisma.transactionLink.findUnique({
    where: { id: linkId },
    include: { transaction: { include: { clientProfile: true } } },
  })

  if (!link?.transaction) {
    return { status: 404, body: { success: false, message: "Invalid link" } }
  }

  const { signatureDataUrl, signedTimezone, signatureMethod, typedValue, fontKey, signatureCity } = input

  if (
    !signatureDataUrl ||
    typeof signatureDataUrl !== "string" ||
    !signatureDataUrl.startsWith("data:image/")
  ) {
    return { status: 400, body: { success: false, message: "A valid signature image is required." } }
  }

  if (!signatureCity) {
    return { status: 400, body: { success: false, message: "Please enter the city of signature before signing." } }
  }

  const methodLabel =
    signatureMethod === "type"
      ? "Typed Signature"
      : signatureMethod === "upload"
        ? "Uploaded Signature"
        : "Canvas Signature"


  const transactionId = link.transaction.id
  const vendorId = link.transaction.vendorId
  const currentTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: clientFlowTransactionInclude,
  })

  if (!currentTransaction) {
    return { status: 404, body: { success: false, message: "Transaction not found" } }
  }

  if (!canRevisitClientStep(currentTransaction, "sign")) {
    return { status: 409, body: { success: false, message: "The signature can no longer be changed after payment has started." } }
  }

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

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { signatureCity },
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
    return { status: 404, body: { success: false, message: "Transaction not found" } }
  }

  const nextStep = getNextClientStep(transaction)

  if (nextStep === "complete") {
    await completeTransactionWithoutPayment(prisma, transactionId)
  }

  return { status: 200, body: { success: true, nextStep } }
}
