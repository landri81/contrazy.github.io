import { beforeEach, describe, expect, it, vi } from "vitest"

/** The partner plan: Enterprise, no Stripe billing, no end date; granted and withdrawn by a super admin. */

const findVendor = vi.fn()
const findSubscription = vi.fn()
const upsert = vi.fn()
const update = vi.fn()
const auditCreate = vi.fn()
const cancelStripe = vi.fn()

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    vendorSubscription: { upsert: (...a: unknown[]) => upsert(...a), update: (...a: unknown[]) => update(...a) },
    auditLog: { create: (...a: unknown[]) => auditCreate(...a) },
  }
  return {
    prisma: {
      vendorProfile: { findUnique: (...a: unknown[]) => findVendor(...a) },
      vendorSubscription: { findUnique: (...a: unknown[]) => findSubscription(...a) },
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})
vi.mock("@/lib/integrations/stripe", () => ({ stripe: { subscriptions: { cancel: (...a: unknown[]) => cancelStripe(...a) } } }))

const { grantPartnerPlan, isPartnerPlanActive, PartnerPlanError, revokePartnerPlan } = await import("./partner-plan")

const actor = { id: "admin_1", email: "admin@contrazy.com" }

beforeEach(() => {
  for (const mock of [findVendor, findSubscription, upsert, update, auditCreate, cancelStripe]) mock.mockReset()
  upsert.mockImplementation(async ({ update: data }: { update: Record<string, unknown> }) => ({ id: "sub_1", ...data }))
  update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "sub_1", ...data }))
})

describe("grantPartnerPlan", () => {
  it("gives an active Enterprise plan with no end date and no Stripe link, logged with the note", async () => {
    findVendor.mockResolvedValue({ id: "vendor_1", subscription: null })
    await grantPartnerPlan("vendor_1", actor, "  LOCAZ, LYNAEL brand ")
    const call = upsert.mock.calls[0][0]
    expect(call.where).toEqual({ vendorId: "vendor_1" })
    expect(call.create).toMatchObject({ vendorId: "vendor_1", planKey: "ENTERPRISE", status: "ACTIVE", currentPeriodEnd: null, stripeSubscriptionId: null, partnerPlan: true, partnerGrantedBy: "admin@contrazy.com", partnerNote: "LOCAZ, LYNAEL brand" })
    expect(cancelStripe).not.toHaveBeenCalled()
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({ actorId: "admin_1", action: "vendor_subscription.partner_plan_granted", entityType: "VendorSubscription" })
  })

  it("cancels a Stripe subscription still running first, so the vendor is never billed next to it", async () => {
    findVendor.mockResolvedValue({ id: "vendor_1", subscription: { planKey: "BUSINESS", status: "TRIALING", stripeSubscriptionId: "sub_stripe_1" } })
    await grantPartnerPlan("vendor_1", actor)
    expect(cancelStripe).toHaveBeenCalledWith("sub_stripe_1")
    expect(auditCreate.mock.calls[0][0].data.metadata).toMatchObject({ previousPlan: "BUSINESS", cancelledStripeSubscriptionId: "sub_stripe_1" })
  })

  it("leaves an already cancelled Stripe subscription alone, and stops if Stripe refuses the cancellation", async () => {
    findVendor.mockResolvedValue({ id: "vendor_1", subscription: { planKey: "BUSINESS", status: "CANCELED", stripeSubscriptionId: "sub_old" } })
    await grantPartnerPlan("vendor_1", actor)
    expect(cancelStripe).not.toHaveBeenCalled()

    findVendor.mockResolvedValue({ id: "vendor_1", subscription: { planKey: "PRO", status: "ACTIVE", stripeSubscriptionId: "sub_live" } })
    cancelStripe.mockRejectedValueOnce(new Error("stripe down"))
    vi.spyOn(console, "error").mockImplementationOnce(() => {})
    await expect(grantPartnerPlan("vendor_1", actor)).rejects.toMatchObject({ code: "stripe_cancel_failed" })
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it("refuses an unknown vendor", async () => {
    findVendor.mockResolvedValue(null)
    await expect(grantPartnerPlan("nope", actor)).rejects.toBeInstanceOf(PartnerPlanError)
  })
})

describe("revokePartnerPlan", () => {
  it("ends the partner plan now and logs it", async () => {
    findSubscription.mockResolvedValue({ partnerPlan: true, status: "ACTIVE" })
    await revokePartnerPlan("vendor_1", actor)
    expect(update.mock.calls[0][0].data).toMatchObject({ status: "CANCELED", partnerPlan: false })
    expect(update.mock.calls[0][0].data.currentPeriodEnd).toBeInstanceOf(Date)
    expect(auditCreate.mock.calls[0][0].data.action).toBe("vendor_subscription.partner_plan_revoked")
  })

  it("refuses a vendor that is not on the partner plan", async () => {
    findSubscription.mockResolvedValue({ partnerPlan: false, status: "ACTIVE" })
    await expect(revokePartnerPlan("vendor_1", actor)).rejects.toMatchObject({ code: "not_on_partner_plan" })
    expect(update).not.toHaveBeenCalled()
  })
})

describe("isPartnerPlanActive", () => {
  it("is true only for an active partner plan", () => {
    expect(isPartnerPlanActive({ partnerPlan: true, status: "ACTIVE" })).toBe(true)
    expect(isPartnerPlanActive({ partnerPlan: true, status: "CANCELED" })).toBe(false)
    expect(isPartnerPlanActive({ partnerPlan: false, status: "ACTIVE" })).toBe(false)
    expect(isPartnerPlanActive(null)).toBe(false)
  })
})
