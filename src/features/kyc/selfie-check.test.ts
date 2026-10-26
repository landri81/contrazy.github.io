import { describe, expect, it } from "vitest"

import {
  buildIdentityVerificationSessionParams,
  isSelfieRequested,
  mapSelfieOutcome,
  resolveSelfieOutcome,
} from "@/features/kyc/selfie-check"
import { createInMemoryStripeGateway } from "@/lib/integrations/stripe-gateway"

const RETURN_URL = "https://app.contrazy.test/en/t/tok_1/kyc/return"
const METADATA = { transactionId: "tx_1", vendorId: "vendor_1", clientProfileId: "client_1" }

async function createSession(requireSelfie: boolean) {
  const gateway = createInMemoryStripeGateway()
  const session = await gateway.identity.createVerificationSession(
    buildIdentityVerificationSessionParams({ returnUrl: RETURN_URL, metadata: METADATA, requireSelfie })
  )

  return { gateway, session }
}

describe("buildIdentityVerificationSessionParams", () => {
  it("sends the pre-C4 document session, with no options key, when no selfie is required", async () => {
    const { gateway, session } = await createSession(false)

    expect(gateway.createdSessions).toEqual([
      { type: "document", return_url: RETURN_URL, metadata: METADATA },
    ])
    expect(gateway.createdSessions[0]).not.toHaveProperty("options")
    expect(isSelfieRequested(session)).toBe(false)
  })

  it("asks Stripe for a live, matching selfie on photo ID documents when a selfie is required", async () => {
    const { gateway, session } = await createSession(true)

    expect(gateway.createdSessions).toEqual([
      {
        type: "document",
        return_url: RETURN_URL,
        metadata: METADATA,
        options: {
          document: {
            require_matching_selfie: true,
            require_live_capture: true,
            allowed_types: ["driving_license", "id_card", "passport"],
          },
        },
      },
    ])
    expect(isSelfieRequested(session)).toBe(true)
  })

  it("does not share the allowed document types array between sessions", () => {
    const first = buildIdentityVerificationSessionParams({ returnUrl: RETURN_URL, metadata: METADATA, requireSelfie: true })
    const firstDocument = first.options?.document as { allowed_types: string[] }
    firstDocument.allowed_types.pop()

    const second = buildIdentityVerificationSessionParams({ returnUrl: RETURN_URL, metadata: METADATA, requireSelfie: true })
    expect(second.options).toEqual({
      document: {
        require_matching_selfie: true,
        require_live_capture: true,
        allowed_types: ["driving_license", "id_card", "passport"],
      },
    })
  })
})

describe("resolveSelfieOutcome with the in-memory Stripe gateway", () => {
  it("stores VERIFIED with no error code when a selfie session is verified", async () => {
    const { gateway, session } = await createSession(true)
    const verified = gateway.simulateOutcome(session.id, { status: "verified" })

    await expect(resolveSelfieOutcome(verified, gateway)).resolves.toEqual({
      selfieCheck: "VERIFIED",
      selfieErrorCode: null,
    })
    // A verified session already proves the selfie matched: no extra report call.
    expect(gateway.reportRequests).toEqual([])
  })

  it.each(["selfie_face_mismatch", "selfie_document_missing_photo", "selfie_manipulated"] as const)(
    "stores UNVERIFIED with %s from the verification report",
    async (errorCode) => {
      const { gateway, session } = await createSession(true)
      const failed = gateway.simulateOutcome(session.id, { status: "requires_input", errorCode })

      await expect(resolveSelfieOutcome(failed, gateway)).resolves.toEqual({
        selfieCheck: "UNVERIFIED",
        selfieErrorCode: errorCode,
      })
      expect(gateway.reportRequests).toEqual([failed.last_verification_report])
    }
  )

  it("stores NOT_REQUESTED for a document-only session, whatever its outcome", async () => {
    const { gateway, session } = await createSession(false)
    const verified = gateway.simulateOutcome(session.id, { status: "verified" })

    await expect(resolveSelfieOutcome(verified, gateway)).resolves.toEqual({
      selfieCheck: "NOT_REQUESTED",
      selfieErrorCode: null,
    })

    const second = await createSession(false)
    const failed = second.gateway.simulateOutcome(second.session.id, {
      status: "requires_input",
      errorCode: "document_expired",
    })

    await expect(resolveSelfieOutcome(failed, second.gateway)).resolves.toEqual({
      selfieCheck: "NOT_REQUESTED",
      selfieErrorCode: null,
    })
    expect(second.gateway.reportRequests).toEqual([])
  })

  it("returns no outcome while the session is still processing", async () => {
    const { gateway, session } = await createSession(true)
    const processing = gateway.simulateOutcome(session.id, { status: "processing" })

    await expect(resolveSelfieOutcome(processing, gateway)).resolves.toBeNull()
  })

  it("falls back to the session last_error when the report cannot be retrieved", async () => {
    const { gateway, session } = await createSession(true)
    const failed = gateway.simulateOutcome(session.id, {
      status: "requires_input",
      errorCode: "selfie_face_mismatch",
    })
    gateway.failReportRetrieval()

    await expect(resolveSelfieOutcome(failed, gateway)).resolves.toEqual({
      selfieCheck: "UNVERIFIED",
      selfieErrorCode: "selfie_face_mismatch",
    })
    expect(gateway.reportRequests).toEqual([failed.last_verification_report])
  })

  it("keeps the selfie VERIFIED when only the document failed", async () => {
    const { gateway, session } = await createSession(true)
    const failed = gateway.simulateOutcome(session.id, {
      status: "requires_input",
      errorCode: "document_expired",
    })

    await expect(resolveSelfieOutcome(failed, gateway)).resolves.toEqual({
      selfieCheck: "VERIFIED",
      selfieErrorCode: null,
    })
  })
})

describe("mapSelfieOutcome", () => {
  it("marks a canceled selfie session UNVERIFIED with the session error code", () => {
    expect(
      mapSelfieOutcome({ requested: true, sessionStatus: "canceled", lastErrorCode: "abandoned" })
    ).toEqual({ selfieCheck: "UNVERIFIED", selfieErrorCode: "abandoned" })
  })

  it("prefers the report's own selfie error over the session error", () => {
    expect(
      mapSelfieOutcome({
        requested: true,
        sessionStatus: "requires_input",
        lastErrorCode: "document_expired",
        reportSelfie: { status: "unverified", error: { code: "selfie_manipulated" } },
      })
    ).toEqual({ selfieCheck: "UNVERIFIED", selfieErrorCode: "selfie_manipulated" })
  })
})
