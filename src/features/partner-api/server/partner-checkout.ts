import { canRevisitClientStep, clientFlowTransactionInclude } from "@/features/client-flow/server/client-flow-data"
import { submitClientDocuments } from "@/features/client-flow/server/steps/submit-documents"
import { presentPartnerCheckout } from "@/features/partner-api/checkout-presenter"
import {
  CHECKOUT_FILE_MAX_BYTES,
  CHECKOUT_FILE_TYPES,
  partnerCheckoutDocumentFieldsSchema,
  type PartnerCheckoutDocumentsSubmitInput,
  type PartnerCheckoutUploadedFile,
} from "@/features/partner-api/schemas/checkout.schema"
import { signCheckoutFile, verifyCheckoutFile } from "@/features/partner-api/server/checkout-files"
import { uploadCheckoutDocument } from "@/features/partner-api/server/checkout-upload"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { normalizeRequirementFileCount } from "@/features/transactions/contract-flow"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { PartnerApiError, type PartnerApiErrorCode } from "@/lib/partner-api/errors"

/** Embedded checkout (M10): the partner drives the customer's steps on its own site; see the API README. */

type Caller = { vendorProfile: { id: string } }

/** The booking as the customer flow sees it (same include as Contrazy's pages), for this vendor only. */
export async function loadCheckoutTransaction(caller: Caller, bookingId: string) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  const transaction = await prisma.transaction.findUnique({ where: { id: booking.id }, include: clientFlowTransactionInclude })
  if (!transaction) throw new PartnerApiError("not_found", "No booking matches this reference for this vendor.")
  return transaction
}

/** `GET /bookings/:id/checkout`. */
export async function getPartnerCheckout(caller: Caller, bookingId: string) {
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

type CheckoutTransaction = Awaited<ReturnType<typeof loadCheckoutTransaction>>

/** The booking's secure link, while the checkout is open (an expired link is closed on the way, as on Contrazy's pages). */
async function openLink(transaction: CheckoutTransaction) {
  if (!transaction.link) throw new PartnerApiError("checkout_closed", "This booking has no customer checkout.")
  const context = await getClientLinkAccessContext(transaction.link.token)
  if (context.state !== "active" || transaction.status === "CANCELLED") throw new PartnerApiError("checkout_closed", "This booking's checkout is closed (cancelled or expired).")
  return context.link
}

function assertDocumentsChangeable(transaction: CheckoutTransaction) {
  if (!canRevisitClientStep(transaction, "documents")) throw new PartnerApiError("step_not_available", "Documents can no longer be changed after payment has started.")
}

type UploadDeps = { secret: string; upload: typeof uploadCheckoutDocument; now?: Date }
const defaultUploadDeps = (): UploadDeps => ({ secret: env.JWT_ENCRYPTION_SECRET, upload: uploadCheckoutDocument })

/** `POST /bookings/:id/checkout/documents/files`: one file stored for a slot of a requirement; its signed fileId back. */
export async function uploadPartnerCheckoutFile(caller: Caller, bookingId: string, form: FormData, deps: UploadDeps = defaultUploadDeps()): Promise<PartnerCheckoutUploadedFile> {
  const fields = partnerCheckoutDocumentFieldsSchema.safeParse({ requirementId: form.get("requirementId"), slotIndex: form.get("slotIndex") })
  if (!fields.success) throw new PartnerApiError("invalid_request", fields.error.issues[0]?.message ?? "requirementId and slotIndex are required.")
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new PartnerApiError("invalid_file", "Send the document as the multipart field `file`.")
  if (!(CHECKOUT_FILE_TYPES as readonly string[]).includes(file.type)) throw new PartnerApiError("invalid_file", "Send a JPEG, PNG, WebP, HEIC or PDF file.")
  if (file.size > CHECKOUT_FILE_MAX_BYTES) throw new PartnerApiError("invalid_file", "The file is larger than 10 MB.")

  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertDocumentsChangeable(transaction)
  const requirement = transaction.requirements.find((item) => item.id === fields.data.requirementId)
  if (!requirement || requirement.type === "TEXT") throw new PartnerApiError("invalid_request", "No document requirement matches this requirementId on this booking.")
  if (fields.data.slotIndex >= normalizeRequirementFileCount(requirement.type, requirement.requiredFileCount)) throw new PartnerApiError("invalid_request", "slotIndex is outside this requirement's files.")

  const fileName = file.name || "document"
  const stored = await deps.upload({ bytes: Buffer.from(await file.arrayBuffer()), fileName, pdf: file.type === "application/pdf" }, link.token)
  const fileId = signCheckoutFile({ bookingId: transaction.id, requirementId: requirement.id, slotIndex: fields.data.slotIndex, publicId: stored.publicId, secureUrl: stored.secureUrl, fileName }, deps.secret, deps.now)
  return { fileId, requirementId: requirement.id, slotIndex: fields.data.slotIndex, fileName }
}

const STEP_REFUSALS: Record<number, PartnerApiErrorCode> = { 400: "invalid_request", 404: "not_found", 409: "step_not_available", 410: "checkout_closed" }

/** `POST /bookings/:id/checkout/documents`: every file of the step at once, through the documents step of Contrazy's pages. */
export async function submitPartnerCheckoutDocuments(caller: Caller, bookingId: string, input: PartnerCheckoutDocumentsSubmitInput, secret = env.JWT_ENCRYPTION_SECRET) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertDocumentsChangeable(transaction)

  const documents = input.files.map((entry) => {
    const file = verifyCheckoutFile(entry.fileId, transaction.id, secret)
    if (!file || file.requirementId !== entry.requirementId || file.slotIndex !== entry.slotIndex) throw new PartnerApiError("invalid_request", "A fileId is unknown, expired, or belongs to another booking or slot.")
    const requirement = transaction.requirements.find((item) => item.id === file.requirementId)
    return { requirementId: file.requirementId, type: requirement?.type, slotIndex: file.slotIndex, source: "UPLOAD" as const, secure_url: file.secureUrl, public_id: file.publicId, original_filename: file.fileName ?? undefined }
  })

  const result = await submitClientDocuments(link, documents)
  if (result.status !== 200) throw new PartnerApiError(STEP_REFUSALS[result.status] ?? "invalid_request", result.body.message ?? "The documents were refused.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}
