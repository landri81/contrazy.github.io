import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

/** Stripe events and the partner plan: an old or unpaid subscription never replaces it; a paid one the vendor starts does. */

const findUnique = vi.fn()
const findUniqueOrThrow = vi.fn()
const upsert = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    vendorSubscription: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => findUniqueOrThrow(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
    $transaction: async (run: (tx: unknown) => unknown) => run({}),
  },
}))
vi.mock("@/lib/integrations/stripe", () => ({ stripe: {} }))
vi.mock("@/features/subscriptions/server/subscription-usage", () => ({ ensureUsageWindow: async () => undefined }))

const { upsertVendorSubscriptionFromStripeSubscription } = await import("./subscription-service")

const partner = { id: "sub_1", vendorId: "vendor_1", planKey: "ENTERPRISE", status: "ACTIVE", partnerPlan: true }

function stripeSubscription(status: Stripe.Subscription.Status) {
  return {
    id: "sub_stripe_old",
    status,
    metadata: { vendorId: "vendor_1", planKey: "BUSINESS" },
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_start: null,
    trial_end: null,
    items: { data: [{ price: { id: "price_1", product: "prod_1", metadata: {}, recurring: { interval: "month" } }, current_period_start: 1_790_000_000, current_period_end: 1_792_600_000 }] },
  } as unknown as Stripe.Subscription
}

beforeEach(() => {
  for (const mock of [findUnique, findUniqueOrThrow, upsert]) mock.mockReset()
  upsert.mockResolvedValue({ ...partner })
  findUniqueOrThrow.mockResolvedValue({ ...partner })
})

describe("upsertVendorSubscriptionFromStripeSubscription and the partner plan", () => {
  it("keeps an active partner plan when an old Stripe subscription reports cancelled or unpaid", async () => {
    findUnique.mockResolvedValue({ ...partner })
    for (const status of ["canceled", "incomplete_expired", "unpaid", "past_due"] as const) {
      expect(await upsertVendorSubscriptionFromStripeSubscription(stripeSubscription(status), "vendor_1")).toMatchObject({ partnerPlan: true, planKey: "ENTERPRISE" })
    }
    expect(upsert).not.toHaveBeenCalled()
  })

  it("lets a paid subscription the vendor starts replace the partner plan", async () => {
    findUnique.mockResolvedValue({ ...partner })
    await upsertVendorSubscriptionFromStripeSubscription(stripeSubscription("active"), "vendor_1")
    expect(upsert.mock.calls[0][0].update).toMatchObject({ planKey: "BUSINESS", status: "ACTIVE", partnerPlan: false })
  })
})
