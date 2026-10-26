import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildIdentityVerificationSessionParams } from "@/features/kyc/selfie-check"
import {
  createInMemoryStripeGateway,
  type FakeVerificationOutcome,
  type InMemoryStripeGateway,
} from "@/lib/integrations/stripe-gateway"

/**
 * C4 handler mapping: the Stripe Identity webhooks store the selfie outcome on
 * KycVerification. Stripe is the in-memory gateway, Prisma an in-memory fake.
 */

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  gateway: null as unknown as InMemoryStripeGateway,
  kyc: new Map<string, Row>(),
  transactions: new Map<string, Row>(),
  events: [] as Row[],
  usageIncrements: 0,
}))

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    kycVerification: {
      findUnique: async ({ where }: { where: { transactionId: string } }) => {
        const row = state.kyc.get(where.transactionId)
        return row ? { status: row.status } : null
      },
      create: async ({ data }: { data: Row }) => {
        const row = { selfieCheck: "NOT_REQUESTED", selfieErrorCode: null, ...data }
        state.kyc.set(data.transactionId as string, row)
        return row
      },
      update: async ({ where, data }: { where: { transactionId: string }; data: Row }) => {
        const row = { ...state.kyc.get(where.transactionId), ...data }
        state.kyc.set(where.transactionId, row)
        return row
      },
    },
    transaction: {
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = { ...state.transactions.get(where.id), ...data }
        state.transactions.set(where.id, row)
        return row
      },
    },
  }

  return { prisma: { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } }
})

vi.mock("@/lib/integrations/stripe", () => ({
  stripeGateway: {
    identity: {
      createVerificationSession: (params: Stripe.Identity.VerificationSessionCreateParams) =>
        state.gateway.identity.createVerificationSession(params),
      retrieveVerificationSession: (id: string) => state.gateway.identity.retrieveVerificationSession(id),
      retrieveVerificationReport: (id: string) => state.gateway.identity.retrieveVerificationReport(id),
    },
  },
}))

vi.mock("@/features/subscriptions/server/subscription-usage", () => ({
  incrementVendorSubscriptionUsage: vi.fn(async () => {
    state.usageIncrements += 1
  }),
}))

vi.mock("@/features/transactions/server/transaction-events", () => ({
  recordTransactionEvent: vi.fn(async (_tx: unknown, event: Row) => {
    state.events.push(event)
  }),
}))

const { handleIdentitySessionRequiresInput, handleIdentitySessionVerified } = await import(
  "@/features/webhooks/stripe/handlers/identity"
)

const TRANSACTION_ID = "tx_1"

async function finishSession(requireSelfie: boolean, outcome: FakeVerificationOutcome) {
  const created = await state.gateway.identity.createVerificationSession(
    buildIdentityVerificationSessionParams({
      returnUrl: "https://app.contrazy.test/en/t/tok_1/kyc/return",
      metadata: { transactionId: TRANSACTION_ID, vendorId: "vendor_1" },
      requireSelfie,
    })
  )

  return state.gateway.simulateOutcome(created.id, outcome)
}

function storedKyc() {
  const row = state.kyc.get(TRANSACTION_ID)
  return { status: row?.status, selfieCheck: row?.selfieCheck, selfieErrorCode: row?.selfieErrorCode }
}

beforeEach(() => {
  state.gateway = createInMemoryStripeGateway()
  state.kyc.clear()
  state.transactions.clear()
  state.events.length = 0
  state.usageIncrements = 0
})

describe("identity.verification_session.verified", () => {
  it("stores a matched selfie when the selfie session is verified", async () => {
    const session = await finishSession(true, { status: "verified" })

    await expect(handleIdentitySessionVerified(session, "evt_1")).resolves.toEqual({
      vendorId: "vendor_1",
      transactionId: TRANSACTION_ID,
    })
    expect(storedKyc()).toEqual({ status: "VERIFIED", selfieCheck: "VERIFIED", selfieErrorCode: null })
    expect(state.transactions.get(TRANSACTION_ID)).toEqual({ status: "KYC_VERIFIED" })
    expect(state.usageIncrements).toBe(1)
  })

  it("stores NOT_REQUESTED for a document-only session", async () => {
    const session = await finishSession(false, { status: "verified" })

    await handleIdentitySessionVerified(session, "evt_1")

    expect(storedKyc()).toEqual({ status: "VERIFIED", selfieCheck: "NOT_REQUESTED", selfieErrorCode: null })
    expect(state.gateway.reportRequests).toEqual([])
  })

  it("updates an existing KYC record and keeps the usage count once", async () => {
    state.kyc.set(TRANSACTION_ID, {
      transactionId: TRANSACTION_ID,
      status: "VERIFIED",
      selfieCheck: "NOT_REQUESTED",
      selfieErrorCode: null,
    })
    const session = await finishSession(true, { status: "verified" })

    await handleIdentitySessionVerified(session, "evt_1")

    expect(storedKyc()).toEqual({ status: "VERIFIED", selfieCheck: "VERIFIED", selfieErrorCode: null })
    expect(state.usageIncrements).toBe(0)
  })
})

describe("identity.verification_session.requires_input", () => {
  it.each(["selfie_face_mismatch", "selfie_document_missing_photo", "selfie_manipulated"] as const)(
    "stores an unverified selfie with %s",
    async (errorCode) => {
      const session = await finishSession(true, { status: "requires_input", errorCode })

      await handleIdentitySessionRequiresInput(session, "evt_2")

      expect(storedKyc()).toEqual({ status: "FAILED", selfieCheck: "UNVERIFIED", selfieErrorCode: errorCode })
      expect(state.gateway.reportRequests).toEqual([session.last_verification_report])
      expect(state.events.map((event) => event.type)).toEqual(["KYC_FAILED", "WEBHOOK_PROCESSED"])
    }
  )

  it("stores NOT_REQUESTED when the failed session did not ask for a selfie", async () => {
    const session = await finishSession(false, { status: "requires_input", errorCode: "document_expired" })

    await handleIdentitySessionRequiresInput(session, "evt_2")

    expect(storedKyc()).toEqual({ status: "FAILED", selfieCheck: "NOT_REQUESTED", selfieErrorCode: null })
  })

  it("uses the session error code when the verification report cannot be retrieved", async () => {
    const session = await finishSession(true, { status: "requires_input", errorCode: "selfie_face_mismatch" })
    state.gateway.failReportRetrieval()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await handleIdentitySessionRequiresInput(session, "evt_2")

    expect(storedKyc()).toEqual({
      status: "FAILED",
      selfieCheck: "UNVERIFIED",
      selfieErrorCode: "selfie_face_mismatch",
    })
    expect(warn).toHaveBeenCalledOnce()
  })

  it("never downgrades a KYC that is already verified", async () => {
    state.kyc.set(TRANSACTION_ID, {
      transactionId: TRANSACTION_ID,
      status: "VERIFIED",
      selfieCheck: "VERIFIED",
      selfieErrorCode: null,
    })
    const session = await finishSession(true, { status: "requires_input", errorCode: "selfie_face_mismatch" })

    await handleIdentitySessionRequiresInput(session, "evt_2")

    expect(storedKyc()).toEqual({ status: "VERIFIED", selfieCheck: "VERIFIED", selfieErrorCode: null })
    expect(state.events).toEqual([])
  })

  it("ignores sessions without transaction metadata", async () => {
    const created = await state.gateway.identity.createVerificationSession({ type: "document" })
    const session = state.gateway.simulateOutcome(created.id, {
      status: "requires_input",
      errorCode: "selfie_face_mismatch",
    })

    await expect(handleIdentitySessionRequiresInput(session, "evt_3")).resolves.toEqual({
      vendorId: null,
      transactionId: null,
    })
    expect(state.kyc.size).toBe(0)
  })
})
