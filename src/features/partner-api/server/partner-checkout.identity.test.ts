import { beforeEach, describe, expect, it, vi } from "vitest"

/** Embedded checkout, identity (M10, C5): Stripe Identity started as on Contrazy's page, coming back to the partner's site. */

const findTransaction = vi.fn()
const linkContext = vi.fn()
const startIdentity = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { JWT_ENCRYPTION_SECRET: "s".repeat(40) } }))
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({ getStripePublishableKey: () => "pk_test_platform" }))
vi.mock("@/lib/integrations/cloudinary", () => ({ cloudinary: {} }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transaction: { findUnique: (...a: unknown[]) => findTransaction(...a) } } }))
vi.mock("@/features/partner-api/server/partner-bookings", async () => {
  const { PartnerApiError } = await vi.importActual<typeof import("@/lib/partner-api/errors")>("@/lib/partner-api/errors")
  return {
    requirePartnerBooking: async (_vendorId: string, where: { id: string }) => ({ id: where.id }),
    assertReturnUrlAllowed: (url: string, origins: string[]) => {
      if (!origins.some((origin) => url.startsWith(origin))) throw new PartnerApiError("return_url_not_allowed", "returnUrl must start with one of the origins allowed for this vendor.")
    },
  }
})
vi.mock("@/features/transactions/server/transaction-links", () => ({ getClientLinkAccessContext: (...a: unknown[]) => linkContext(...a) }))
vi.mock("@/features/client-flow/server/steps/start-identity", () => ({ startClientIdentityVerification: (...a: unknown[]) => startIdentity(...a) }))

const { startPartnerCheckoutIdentity } = await import("./partner-checkout")
const { PartnerApiError } = await import("@/lib/partner-api/errors")

const caller = { vendorProfile: { id: "vendor_locaz", partnerAllowedOrigins: ["https://www.locaz.co", "https://locaz.co"] } }
const RETURN = "https://locaz.co/booking/checkout/LZ-2026-000300"
const code = async (run: Promise<unknown>) => run.then(() => "accepted", (error) => (error instanceof PartnerApiError ? error.code : String(error)))

beforeEach(() => {
  vi.clearAllMocks()
  findTransaction.mockResolvedValue({ id: "tx_1", status: "LINK_SENT", link: { token: "tok_1", status: "ACTIVE", expiresAt: null } })
  linkContext.mockResolvedValue({ state: "active", link: { id: "link_1", token: "tok_1", transaction: { id: "tx_1" } } })
  startIdentity.mockResolvedValue({ status: 200, body: { success: true, url: "https://verify.stripe.com/start/test_x", clientSecret: "vs_123_secret_test" } })
})

describe("startPartnerCheckoutIdentity", () => {
  it("starts Stripe Identity for the booking's link, coming back to the partner's page, with the platform's publishable key", async () => {
    expect(await startPartnerCheckoutIdentity(caller, "tx_1", { returnUrl: RETURN })).toEqual({ clientSecret: "vs_123_secret_test", url: "https://verify.stripe.com/start/test_x", publishableKey: "pk_test_platform" })
    expect(startIdentity).toHaveBeenCalledWith("link_1", "tok_1", { returnUrl: RETURN })
  })

  it("refuses a return address outside the vendor's origins before starting anything", async () => {
    expect(await code(startPartnerCheckoutIdentity(caller, "tx_1", { returnUrl: "https://evil.example/back" }))).toBe("return_url_not_allowed")
    expect(startIdentity).not.toHaveBeenCalled()
  })

  it("passes on the step's refusals: payment started, no identity on the plan, closed checkout", async () => {
    startIdentity.mockResolvedValueOnce({ status: 409, body: { success: false, message: "Identity details can no longer be changed after payment has started." } })
    expect(await code(startPartnerCheckoutIdentity(caller, "tx_1", { returnUrl: RETURN }))).toBe("step_not_available")
    startIdentity.mockResolvedValueOnce({ status: 422, body: { success: false, message: "Stripe Identity is not available on this plan." } })
    expect(await code(startPartnerCheckoutIdentity(caller, "tx_1", { returnUrl: RETURN }))).toBe("plan_feature_unavailable")
    linkContext.mockResolvedValueOnce({ state: "cancelled", link: {} })
    expect(await code(startPartnerCheckoutIdentity(caller, "tx_1", { returnUrl: RETURN }))).toBe("checkout_closed")
  })
})
