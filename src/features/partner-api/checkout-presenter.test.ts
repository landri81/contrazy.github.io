import { describe, expect, it, vi } from "vitest"

import type { ClientFlowTransaction } from "@/features/client-flow/server/client-flow-data"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: {} }))
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }))
// The flow helpers sit next to link and e-mail code the presenter never calls.
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({}))

const { presentPartnerCheckout } = await import("./checkout-presenter")

/** Embedded checkout state (M10): the same steps and order as Contrazy's pages, named for partners. */

const NOW = new Date("2026-11-05T09:00:00Z")

const profile = {
  firstName: "Lina",
  lastName: "Martin",
  email: "lina@locaz.test",
  address: "12 rue de France, 06000 Nice",
  country: "FR",
  birthCity: "Nice",
  birthDate: new Date("1988-05-20T00:00:00Z"),
  companyName: null,
}

const licence = { id: "req_licence", label: "Permis de conduire", instructions: null, type: "DOCUMENT", category: "DRIVER_LICENSE", requiredFileCount: 2, fileSlotLabels: ["Recto", "Verso"], required: true }
const file = (slotIndex: number) => ({ id: `doc_${slotIndex}`, requirementId: "req_licence", label: "Permis de conduire", slotIndex, slotLabel: slotIndex ? "Verso" : "Recto", fileName: `permis-${slotIndex}.jpg`, assetUrl: `https://res.cloudinary.com/x/${slotIndex}.jpg`, publicId: `p${slotIndex}`, textValue: null, uploadedAt: new Date("2026-11-05T08:50:00Z") })

/** A LOCAZ booking as the partner API creates it: documents, identity, contract, payment, deposit hold, card. */
function booking(patch: Record<string, unknown> = {}) {
  return {
    id: "tx_1",
    status: "LINK_SENT",
    locale: "fr",
    currency: "EUR",
    amount: 15_700,
    depositAmount: 80_000,
    paymentCollectionTiming: "IMMEDIATE",
    requiresKyc: true,
    requireSelfie: false,
    requireClientCompany: false,
    stepSwitches: { identity: true, documents: true, contract: true, payment: true, cardSecurity: true, hold: true },
    flowType: "STANDARD",
    checkOutRequestedAt: null,
    clientProfileId: "cp_1",
    clientProfile: profile,
    link: { token: "tok", status: "ACTIVE", expiresAt: new Date("2026-11-05T09:30:00Z") },
    requirements: [licence],
    documents: [],
    customFields: [],
    kycVerification: null,
    contractTemplateId: "tpl_1",
    contractTemplate: { id: "tpl_1" },
    contractArtifact: null,
    signatureRecord: null,
    events: [],
    payments: [],
    depositAuthorization: null,
    cardSecurity: null,
    reportFields: [],
    reports: [],
    ...patch,
  } as unknown as ClientFlowTransaction
}

describe("presentPartnerCheckout", () => {
  it("a new booking: every step asked, the documents first, the deposit hold before the rental payment", () => {
    const checkout = presentPartnerCheckout(booking(), NOW)
    expect(checkout).toMatchObject({ bookingId: "tx_1", status: "open", nextStep: "documents", expiresAt: "2026-11-05T09:30:00.000Z" })
    expect(checkout.steps).toEqual({
      documents: { required: true, done: false },
      identity: { required: true, done: false },
      contract: { required: true, done: false },
      signature: { required: true, done: false },
      payment: { required: true, done: false },
      card: { required: true, done: false },
    })
    expect(checkout.requirements[0]).toMatchObject({ id: "req_licence", category: "DRIVER_LICENSE", fileCount: 2, slotLabels: ["Recto", "Verso"], files: [], complete: false })
    expect(checkout.payment).toEqual({ stage: "deposit", amount: 15_700, depositAmount: 80_000, currency: "eur" })
    expect(checkout.identity).toEqual({ required: true, selfie: false, status: "not_started" })
  })

  it("asks the profile when the booking lacks the customer's birth place or address", () => {
    expect(presentPartnerCheckout(booking({ clientProfile: { ...profile, birthCity: null } }), NOW).nextStep).toBe("profile")
  })

  it("moves on: both sides of the licence, then identity; an identity check under way lets the customer go on to the contract", () => {
    const withFiles = booking({ documents: [file(0), file(1)] })
    expect(presentPartnerCheckout(withFiles, NOW)).toMatchObject({ nextStep: "identity", steps: { documents: { done: true } } })
    expect(presentPartnerCheckout(withFiles, NOW).requirements[0].files).toHaveLength(2)

    const pending = booking({ documents: [file(0), file(1)], kycVerification: { status: "PENDING" } })
    expect(presentPartnerCheckout(pending, NOW)).toMatchObject({ nextStep: "contract", identity: { status: "pending" }, steps: { identity: { done: true } } })
  })

  it("contract read but not signed asks the signature; signed, the payment", () => {
    const reviewed = booking({ documents: [file(0), file(1)], kycVerification: { status: "VERIFIED" }, contractArtifact: { reviewCompletedAt: new Date(), signedPdfUrl: null } })
    expect(presentPartnerCheckout(reviewed, NOW)).toMatchObject({ nextStep: "signature", contract: { accepted: true, signed: false } })

    const signed = booking({ documents: [file(0), file(1)], kycVerification: { status: "VERIFIED" }, contractArtifact: { reviewCompletedAt: new Date(), signedPdfUrl: "https://x/signed.pdf" }, signatureRecord: { status: "SIGNED" } })
    expect(presentPartnerCheckout(signed, NOW)).toMatchObject({ nextStep: "payment", contract: { signed: true }, payment: { stage: "deposit" } })
  })

  it("after the deposit and the rental payment, the card; then complete", () => {
    const paid = {
      documents: [file(0), file(1)],
      kycVerification: { status: "VERIFIED" },
      contractArtifact: { reviewCompletedAt: new Date(), signedPdfUrl: "https://x/signed.pdf" },
      signatureRecord: { status: "SIGNED" },
      depositAuthorization: { status: "AUTHORIZED" },
      payments: [{ kind: "SERVICE_PAYMENT", status: "SUCCEEDED" }],
    }
    expect(presentPartnerCheckout(booking(paid), NOW)).toMatchObject({ nextStep: "payment", payment: { stage: "card" }, steps: { payment: { done: true }, card: { done: false } } })

    const done = presentPartnerCheckout(booking({ ...paid, cardSecurity: { status: "SECURED" }, status: "COMPLETED" }), NOW)
    expect(done).toMatchObject({ status: "completed", nextStep: "complete", payment: { stage: "complete" }, steps: { card: { done: true } } })
  })

  it("switched-off steps are not asked, and done", () => {
    const light = booking({ requiresKyc: false, contractTemplateId: null, contractTemplate: null, stepSwitches: { documents: false, payment: true }, requirements: [], depositAmount: null })
    const checkout = presentPartnerCheckout(light, NOW)
    expect(checkout.steps).toMatchObject({ documents: { required: false }, identity: { required: false, done: true }, contract: { required: false, done: true }, card: { required: false, done: true } })
    expect(checkout).toMatchObject({ nextStep: "payment", payment: { stage: "rental", depositAmount: 0 } })
  })

  it("closed: a cancelled booking, an expired link", () => {
    expect(presentPartnerCheckout(booking({ link: { token: "tok", status: "CANCELLED", expiresAt: null } }), NOW).status).toBe("cancelled")
    expect(presentPartnerCheckout(booking({ link: { token: "tok", status: "ACTIVE", expiresAt: new Date("2026-11-05T08:00:00Z") } }), NOW).status).toBe("expired")
  })
})
