import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A PENDING identity check read from Stripe while the partner polls (LOCAZ LZ-2026-000277, 6 Nov 2026: Stripe answered
 * in 2 seconds, the page waited for ever). The webhook handlers are mocked: they store the result.
 */

const verified = vi.fn(async () => ({ vendorId: "vendor_1", transactionId: "tx_1" }))
const requiresInput = vi.fn(async () => ({ vendorId: "vendor_1", transactionId: "tx_1" }))
vi.mock("@/features/webhooks/stripe/handlers/identity", () => ({
  handleIdentitySessionVerified: (...a: unknown[]) => verified(...(a as [])),
  handleIdentitySessionRequiresInput: (...a: unknown[]) => requiresInput(...(a as [])),
}))
vi.mock("@/lib/integrations/stripe", () => ({ stripeGateway: {} }))

const { syncPendingIdentity } = await import("./pending-identity")

const PENDING = { status: "PENDING", providerReference: "vs_1" }
const session = (fields: Partial<Stripe.Identity.VerificationSession>) =>
  ({ id: "vs_1", object: "identity.verification_session", status: "requires_input", last_error: null, metadata: { transactionId: "tx_1", vendorId: "vendor_1" }, ...fields }) as Stripe.Identity.VerificationSession
const gatewayWith = (result: Stripe.Identity.VerificationSession | Error) => {
  const retrieveVerificationSession = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  return { retrieveVerificationSession, identity: { retrieveVerificationSession } as never }
}

beforeEach(() => vi.clearAllMocks())

describe("syncPendingIdentity", () => {
  it("stores a check Stripe verified, as the webhook does", async () => {
    const verifiedSession = session({ status: "verified" })
    expect(await syncPendingIdentity(PENDING, gatewayWith(verifiedSession))).toBe("settled")
    expect(verified).toHaveBeenCalledWith(verifiedSession, "status-check:vs_1:verified")
    expect(requiresInput).not.toHaveBeenCalled()
  })

  it("stores a check Stripe refused (requires_input with its error) and a cancelled one as failed", async () => {
    const refused = session({ last_error: { code: "document_unverified_other", reason: "The document could not be verified." } as never })
    expect(await syncPendingIdentity(PENDING, gatewayWith(refused))).toBe("settled")
    expect(requiresInput).toHaveBeenCalledWith(refused, "status-check:vs_1:requires_input")
    expect(await syncPendingIdentity(PENDING, gatewayWith(session({ status: "canceled" })))).toBe("settled")
    expect(requiresInput).toHaveBeenCalledTimes(2)
    expect(verified).not.toHaveBeenCalled()
  })

  it("leaves a session nothing was sent to (Stripe's window closed) as unsubmitted, and one still processing as waiting", async () => {
    expect(await syncPendingIdentity(PENDING, gatewayWith(session({})))).toBe("unsubmitted")
    expect(await syncPendingIdentity(PENDING, gatewayWith(session({ status: "processing" })))).toBe("waiting")
    expect(verified).not.toHaveBeenCalled()
    expect(requiresInput).not.toHaveBeenCalled()
  })

  it("waits when Stripe cannot be reached, and asks nothing for a check that is not pending", async () => {
    expect(await syncPendingIdentity(PENDING, gatewayWith(new Error("network")))).toBe("waiting")
    const gateway = gatewayWith(session({ status: "verified" }))
    for (const kyc of [null, { status: "VERIFIED", providerReference: "vs_1" }, { status: "FAILED", providerReference: "vs_1" }, { status: "PENDING", providerReference: null }]) {
      expect(await syncPendingIdentity(kyc, gateway)).toBeNull()
    }
    expect(gateway.retrieveVerificationSession).not.toHaveBeenCalled()
  })
})
