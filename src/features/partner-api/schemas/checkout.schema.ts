import { z } from "zod"

/**
 * Embedded checkout (M10): the partner shows every customer step on its own site and drives it through these calls;
 * the customer never opens Contrazy's pages. This file is the contract: the request bodies of every checkout call and
 * the shape of the checkout state. Each route validates with these schemas and answers with `PartnerCheckout`.
 */

/** The customer's IP and browser, forwarded by the partner on every write (kept as Contrazy's own pages keep them). */
export const CUSTOMER_IP_HEADER = "Contrazy-Customer-Ip"
export const CUSTOMER_USER_AGENT_HEADER = "Contrazy-Customer-User-Agent"

export const PARTNER_CHECKOUT_STEPS = ["documents", "identity", "contract", "signature", "payment", "card"] as const
export type PartnerCheckoutStepKey = (typeof PARTNER_CHECKOUT_STEPS)[number]

/**
 * Where the customer is. `profile` only when the booking lacks the customer's address (update the booking); `details`
 * and `check_in` run on Contrazy's pages only (partner bookings have no custom questions; keep `checkIn` off for an
 * embedded checkout).
 */
export type PartnerCheckoutNextStep = "profile" | "details" | "check_in" | PartnerCheckoutStepKey | "complete"

export type PartnerCheckoutFile = { id: string; slot: number; slotLabel: string | null; fileName: string | null; uploadedAt: string }

export type PartnerCheckoutRequirement = {
  id: string
  label: string
  instructions: string | null
  category: string
  required: boolean
  fileCount: number
  slotLabels: string[]
  files: PartnerCheckoutFile[]
  complete: boolean
}

/** `GET /bookings/:id/checkout`, and the answer of every step call that moves the customer on. */
export type PartnerCheckout = {
  bookingId: string
  status: "open" | "completed" | "cancelled" | "expired"
  nextStep: PartnerCheckoutNextStep
  expiresAt: string | null
  steps: Record<PartnerCheckoutStepKey, { required: boolean; done: boolean }>
  requirements: PartnerCheckoutRequirement[]
  identity: { required: boolean; selfie: boolean; status: "not_started" | "pending" | "verified" | "failed" }
  contract: { required: boolean; accepted: boolean; signed: boolean }
  payment: { stage: "deposit" | "rental" | "card" | "complete"; amount: number; depositAmount: number; currency: string }
}

/** Files the documents step accepts: phone photos and PDF, 10 MB at most. */
export const CHECKOUT_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"] as const
export const CHECKOUT_FILE_MAX_BYTES = 10 * 1024 * 1024

/** `POST /bookings/:id/checkout/documents/files` (multipart): the text fields; `file` is checked by type and size. */
export const partnerCheckoutDocumentFieldsSchema = z.object({
  requirementId: z.string().trim().min(1).max(100),
  slotIndex: z.coerce.number().int().min(0).max(19),
})

/** `POST /bookings/:id/checkout/documents/files` answer: a signed reference to the stored file, valid for this booking. */
export type PartnerCheckoutUploadedFile = { fileId: string; requirementId: string; slotIndex: number; fileName: string | null }

/** `POST /bookings/:id/checkout/documents`: every file of the step at once (as Contrazy's page submits them). */
export const partnerCheckoutDocumentsSubmitSchema = z.object({
  files: z
    .array(z.object({ requirementId: z.string().trim().min(1).max(100), slotIndex: z.number().int().min(0).max(19), fileId: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(40),
})

/** `POST /bookings/:id/checkout/identity`: where Stripe's hosted check sends the customer back (an allowed origin). */
export const partnerCheckoutIdentitySchema = z.object({
  returnUrl: z.string().trim().url("returnUrl must be an absolute URL").max(2000),
})

/** `GET /bookings/:id/checkout/contract` answer. */
export type PartnerCheckoutContract = { html: string; version: string; locale: string }

/** `POST /bookings/:id/checkout/contract/accept`: the version the customer read (refused if it changed since). */
export const partnerCheckoutContractAcceptSchema = z.object({
  version: z.string().trim().min(8).max(128),
})

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/

/** `POST /bookings/:id/checkout/signature`: a drawn signature (PNG) or a typed name in a handwriting font. */
export const partnerCheckoutSignatureSchema = z
  .object({
    method: z.enum(["draw", "type"]),
    image: z.string().max(700_000).regex(PNG_DATA_URL, "image must be a PNG data URL").optional(),
    typedName: z.string().trim().min(2).max(120).optional(),
    font: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    timezone: z.string().trim().min(1).max(64),
  })
  .strict()
  .refine((body) => (body.method === "draw" ? Boolean(body.image) : Boolean(body.typedName)), {
    message: "a drawn signature needs image, a typed one needs typedName",
    path: ["method"],
  })

/** `POST /bookings/:id/checkout/payment` answer: confirm it in the browser with Stripe.js on the connected account. */
export type PartnerCheckoutPayment = {
  stage: "deposit" | "rental"
  clientSecret: string
  stripeAccountId: string
  publishableKey: string
  amount: number
  currency: string
}

/** `POST /bookings/:id/checkout/payment/confirm`. */
export const partnerCheckoutPaymentConfirmSchema = z.object({
  paymentIntentId: z.string().trim().regex(/^pi_[A-Za-z0-9]+$/, "paymentIntentId must be a Stripe PaymentIntent id"),
})

/** `POST /bookings/:id/checkout/card`: the consent the customer accepted, as shown on the partner's page. */
export const partnerCheckoutCardSchema = z.object({
  consentVersion: z.string().trim().min(1).max(64),
  consentText: z.string().trim().min(20).max(4000),
})

/** `POST /bookings/:id/checkout/card` answer: confirm the SetupIntent in the browser with Stripe.js. */
export type PartnerCheckoutCard = { clientSecret: string; stripeAccountId: string; publishableKey: string }

/** `POST /bookings/:id/checkout/card/confirm`. */
export const partnerCheckoutCardConfirmSchema = z.object({
  setupIntentId: z.string().trim().regex(/^seti_[A-Za-z0-9]+$/, "setupIntentId must be a Stripe SetupIntent id"),
})

/** `POST /bookings/:id/checkout/identity` answer: Stripe's modal (clientSecret) or its hosted page (url). */
export type PartnerCheckoutIdentity = { clientSecret: string; url: string; publishableKey: string }
