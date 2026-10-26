import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildBookingPayload } from "@/features/partner-api/__fixtures__/booking-payload"
import { generatePartnerApiKey } from "@/lib/partner-api/keys"
import { partnerApiRateLimiter } from "@/lib/partner-api/rate-limit"

/**
 * Route tests for the C2 partner bookings API. Prisma is an in-memory fake;
 * the dashboard launch helpers are spies so the tests prove the routes go
 * through `prepareVendorTransactionLaunch` / `createPreparedVendorTransaction`
 * and `cancelTransactionLink` instead of a copy of that logic.
 */

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  keys: [] as Row[],
  auditRows: [] as Array<{ data: Row }>,
  idempotency: [] as Row[],
  transactions: [] as Row[],
  clientProfiles: [] as Row[],
  vendors: {} as Record<string, Row>,
  sequence: 0,
}))

function uniqueError() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
}

vi.mock("@/lib/db/prisma", () => {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => value === undefined || row[key] === value)

  const withRelations = (row: Row) => ({
    ...row,
    clientProfile: db.clientProfiles.find((profile) => profile.id === row.clientProfileId) ?? null,
  })

  const prisma: Record<string, unknown> = {
    partnerApiKey: {
      findUnique: vi.fn(async ({ where }: { where: { hashedKey: string } }) => {
        const key = db.keys.find((item) => item.hashedKey === where.hashedKey)
        return key ? { ...key, vendor: db.vendors[key.vendorId as string] } : null
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditLog: {
      create: vi.fn(async (args: { data: Row }) => {
        db.auditRows.push(args)
        return { id: `audit_${db.auditRows.length}`, ...args.data }
      }),
    },
    partnerIdempotencyKey: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (db.idempotency.some((row) => row.vendorId === data.vendorId && row.key === data.key)) {
          throw uniqueError()
        }

        const row = {
          id: `idem_${++db.sequence}`,
          responseStatus: null,
          responseBody: null,
          transactionId: null,
          completedAt: null,
          createdAt: new Date(),
          ...data,
        }
        db.idempotency.push(row)
        return row
      }),
      findUnique: vi.fn(async ({ where }: { where: { vendorId_key: { vendorId: string; key: string } } }) => {
        const { vendorId, key } = where.vendorId_key
        return db.idempotency.find((row) => row.vendorId === vendorId && row.key === key) ?? null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = db.idempotency.find((item) => item.id === where.id)
        return Object.assign(row ?? {}, data)
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        const before = db.idempotency.length
        db.idempotency = db.idempotency.filter((row) => !(row.id === where.id && row.responseStatus === null))
        return { count: before - db.idempotency.length }
      }),
    },
    transaction: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const row = db.transactions.find((item) => matches(item, where))
        return row ? withRelations(row) : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = db.transactions.find((item) => item.id === where.id)
        return Object.assign(row ?? {}, data, { updatedAt: new Date() })
      }),
    },
    clientProfile: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `client_${++db.sequence}`, ...data }
        db.clientProfiles.push(row)
        return row
      }),
    },
    contractTemplate: {
      findFirst: vi.fn(async ({ where }: { where: { vendorId: string } }) =>
        where.vendorId === "vendor_1" ? { id: "tpl_default" } : null
      ),
    },
    transactionRequirement: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    transactionCustomField: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    transactionReportField: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    transactionContractArtifact: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  }

  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma))

  return { prisma }
})

vi.mock("@/features/transactions/server/vendor-transaction-launch", () => ({
  prepareVendorTransactionLaunch: vi.fn(async ({ data }: { data: Row }) => ({
    ok: true,
    prepared: {
      baseUrl: "https://app.contrazy.test",
      locale: "en",
      title: data.title,
      serviceDate: data.serviceDate,
      generateQr: data.generateQr,
      amount: data.amount,
      depositAmount: data.depositAmount,
      depositHoldDays: data.depositHoldDays,
      requiresKyc: data.requiresKyc,
      kind: "HYBRID",
      flowType: data.flowType,
      paymentCollectionTiming: data.paymentCollectionTiming,
      contractTemplate: data.contractTemplateId ? { id: data.contractTemplateId } : null,
      requirementDefinitions: [],
      customFieldDefinitions: [],
      reportFieldDefinitions: [],
    },
  })),
  createPreparedVendorTransaction: vi.fn(
    async (_tx: unknown, prepared: Row, options: { vendorId: string; extraTransactionData: Row }) => {
      const id = `tx_${++db.sequence}`
      const now = new Date("2026-10-24T10:00:00.000Z")
      const row: Row = {
        id,
        vendorId: options.vendorId,
        reference: `TX-${String(db.sequence).padStart(8, "0")}`,
        status: "LINK_SENT",
        locale: prepared.locale,
        currency: "EUR",
        amount: prepared.amount,
        depositAmount: prepared.depositAmount,
        kind: prepared.kind,
        flowType: prepared.flowType,
        serviceDate: prepared.serviceDate,
        contractTemplateId: (prepared.contractTemplate as Row | null)?.id ?? null,
        link: {
          id: `link_${id}`,
          token: `token_${id}`,
          status: "ACTIVE",
          openedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
          qrCodeSvg: null,
        },
        requirements: [],
        reportFields: [],
        reports: [],
        kycVerification: null,
        signatureRecord: null,
        contractArtifact: null,
        payments: [],
        depositAuthorization: null,
        cardSecurity: null,
        postCharges: [],
        events: [],
        createdAt: now,
        updatedAt: now,
        ...options.extraTransactionData,
      }
      db.transactions.push(row)
      return { id, reference: row.reference }
    }
  ),
  writePreparedTransactionConfiguration: vi.fn(async () => []),
}))

vi.mock("@/features/transactions/server/transaction-links", () => ({
  cancelTransactionLink: vi.fn(async (_db: unknown, input: { linkId: string; reason: string }) => {
    const row = db.transactions.find((item) => (item.link as Row | null)?.id === input.linkId)

    if (!row) {
      return { ok: false, code: "NOT_FOUND" }
    }

    row.status = "CANCELLED"
    row.link = { ...(row.link as Row), status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason }
    return { ok: true }
  }),
}))

vi.mock("@/lib/auth/guards", () => ({
  isVendorApproved: () => true,
  getVendorStatusMessage: () => "Vendor is not approved.",
  ensureVendorSubscriptionEligible: vi.fn(async () => ({ response: null, subscription: { id: "sub_1" } })),
}))

vi.mock("@/features/subscriptions/server/subscription-usage", () => ({
  incrementVendorSubscriptionUsageFields: vi.fn(async () => undefined),
}))

vi.mock("@/features/transactions/server/transaction-events", () => ({
  recordTransactionEvent: vi.fn(async () => undefined),
}))

vi.mock("@/lib/integrations/stripe", () => ({
  getAppBaseUrl: () => "https://app.contrazy.test",
}))

vi.mock("@/lib/integrations/cloudinary-assets", () => ({
  resolveDocumentAssetUrl: (url: string | null | undefined) => url ?? null,
}))

const launch = await import("@/features/transactions/server/vendor-transaction-launch")
const links = await import("@/features/transactions/server/transaction-links")
const { NextResponse } = await import("next/server")
const collection = await import("@/app/api/partner/v1/bookings/route")
const item = await import("@/app/api/partner/v1/bookings/[id]/route")
const cancel = await import("@/app/api/partner/v1/bookings/[id]/cancel/route")

const BASE = "http://localhost/api/partner/v1/bookings"

function storeKey(vendorId = "vendor_1", scopes = ["bookings:read", "bookings:write"]) {
  const generated = generatePartnerApiKey("TEST")
  db.keys.push({
    id: `key_${db.keys.length + 1}`,
    vendorId,
    name: "LOCAZ test",
    prefix: generated.prefix,
    hashedKey: generated.hashedKey,
    scopes,
    mode: "TEST",
    lastUsedAt: null,
    createdById: "user_1",
    revokedAt: null,
    createdAt: new Date("2026-10-24T08:00:00.000Z"),
  })
  return generated.key
}

function request(method: string, url: string, key: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function create(key: string, body: unknown, idempotencyKey: string | null = "idem-1") {
  return collection.POST(
    request("POST", BASE, key, body, idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    { params: Promise.resolve({}) }
  )
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function createBooking(key: string, overrides: Record<string, unknown> = {}, idempotencyKey = "idem-create") {
  const response = await create(key, buildBookingPayload(overrides), idempotencyKey)
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string; externalRef: string }
}

beforeEach(() => {
  db.keys.length = 0
  db.auditRows.length = 0
  db.idempotency = []
  db.transactions.length = 0
  db.clientProfiles.length = 0
  db.sequence = 0
  db.vendors = {
    vendor_1: { id: "vendor_1", businessName: "Riviera Rentals", reviewStatus: "APPROVED", partnerAllowedOrigins: ["https://locaz.co"] },
    vendor_2: { id: "vendor_2", businessName: "Other Rentals", reviewStatus: "APPROVED", partnerAllowedOrigins: [] },
  }
  partnerApiRateLimiter.reset()
  vi.mocked(launch.prepareVendorTransactionLaunch).mockClear()
  vi.mocked(launch.createPreparedVendorTransaction).mockClear()
  vi.mocked(links.cancelTransactionLink).mockClear()
})

describe("POST /api/partner/v1/bookings", () => {
  it("creates a booking through the dashboard launch helpers and returns 201", async () => {
    const key = storeKey()
    const response = await create(key, buildBookingPayload())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get("request_id")).toMatch(/^req_/)
    expect(Object.keys(body).sort()).toEqual(
      ["createdAt", "customerUrl", "endAt", "externalRef", "id", "reference", "startAt", "status", "steps"].sort()
    )
    expect(body).toMatchObject({
      externalRef: "LZ-TEST-0001",
      status: "link_sent",
      customerUrl: expect.stringMatching(/^https:\/\/app\.contrazy\.test\/fr\/t\/token_tx_/),
      startAt: "2026-11-02T08:00:00.000Z",
      endAt: "2026-11-05T17:00:00.000Z",
    })
    expect(body.steps).toHaveLength(9)
    expect(body.steps.find((step: { key: string }) => step.key === "selfie")).toMatchObject({ status: "skipped", required: false })
    expect(body.steps.find((step: { key: string }) => step.key === "identity")).toMatchObject({ status: "pending", required: true })

    expect(launch.prepareVendorTransactionLaunch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(launch.prepareVendorTransactionLaunch).mock.calls[0]?.[0]).toMatchObject({
      allowRecreate: false,
      data: { requiresKyc: true, contractTemplateId: "tpl_default", flowType: "CHECK_IN_OUT" },
    })
    expect(vi.mocked(launch.createPreparedVendorTransaction).mock.calls[0]?.[2]).toMatchObject({
      vendorId: "vendor_1",
      extraTransactionData: { source: "PARTNER_API", externalRef: "LZ-TEST-0001", timezone: "Europe/Paris" },
    })
    expect(db.idempotency[0]).toMatchObject({ responseStatus: 201, transactionId: body.id })
  })

  it("replays the first response for the same Idempotency-Key and body", async () => {
    const key = storeKey()
    const first = await create(key, buildBookingPayload())
    const firstBody = await first.json()
    // Same content, different key order: still the same request.
    const { externalRef, ...rest } = buildBookingPayload()
    const replay = await create(key, { ...rest, externalRef })

    expect(replay.status).toBe(201)
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true")
    expect(await replay.json()).toEqual(firstBody)
    expect(launch.prepareVendorTransactionLaunch).toHaveBeenCalledTimes(1)
    expect(db.transactions).toHaveLength(1)
  })

  it("returns 409 when the same Idempotency-Key comes with a different body", async () => {
    const key = storeKey()
    await create(key, buildBookingPayload())
    const conflict = await create(key, buildBookingPayload({ amount: 16000 }))

    expect(conflict.status).toBe(409)
    expect((await conflict.json()).error.code).toBe("idempotency_key_conflict")
    expect(db.transactions).toHaveLength(1)
  })

  it("requires an Idempotency-Key header", async () => {
    const response = await create(storeKey(), buildBookingPayload(), null)

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe("idempotency_key_required")
  })

  it("refuses a returnUrl outside the vendor allow-list with 422 and frees the key", async () => {
    const key = storeKey()
    const response = await create(key, buildBookingPayload({ returnUrl: "https://evil.test/back" }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({ code: "return_url_not_allowed", details: { returnUrlOrigin: "https://evil.test" } })
    expect(launch.prepareVendorTransactionLaunch).not.toHaveBeenCalled()
    expect(db.idempotency).toHaveLength(0)

    const retry = await create(key, buildBookingPayload())
    expect(retry.status).toBe(201)
  })

  it("maps plan limits to 402 and plan features to 403 with a clear code", async () => {
    const key = storeKey()

    vi.mocked(launch.prepareVendorTransactionLaunch).mockResolvedValueOnce({
      ok: false,
      code: "transaction_limit_reached",
      response: NextResponse.json({ success: false, message: "No transactions left." }, { status: 422 }),
    })
    const limit = await create(key, buildBookingPayload(), "idem-limit")
    expect(limit.status).toBe(402)
    expect((await limit.json()).error).toMatchObject({
      code: "plan_limit_reached",
      message: "No transactions left.",
      details: { reason: "transaction_limit_reached" },
    })

    vi.mocked(launch.prepareVendorTransactionLaunch).mockResolvedValueOnce({
      ok: false,
      code: "kyc_not_in_plan",
      response: NextResponse.json({ success: false, message: "No KYC on this plan." }, { status: 422 }),
    })
    const feature = await create(key, buildBookingPayload(), "idem-feature")
    expect(feature.status).toBe(403)
    expect((await feature.json()).error.code).toBe("plan_feature_unavailable")
    expect(db.transactions).toHaveLength(0)
  })

  it("validates the body with zod (endAt after startAt)", async () => {
    const response = await create(storeKey(), buildBookingPayload({ endAt: "2026-11-01T09:00:00+01:00" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe("invalid_request")
    expect(body.error.details.issues).toContainEqual({ path: "endAt", message: "endAt must be after startAt" })
  })

  it("needs the bookings:write scope", async () => {
    const response = await create(storeKey("vendor_1", ["bookings:read"]), buildBookingPayload())

    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("insufficient_scope")
  })

  it("serves Italian customers the English flow", async () => {
    const payload = buildBookingPayload()
    const response = await create(storeKey(), { ...payload, customer: { ...payload.customer, locale: "it" } })

    expect(response.status).toBe(201)
    expect((await response.json()).customerUrl).toContain("/en/t/")
  })
})

describe("GET /api/partner/v1/bookings", () => {
  it("returns status, step progress and summaries by id and by externalRef", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)

    const byId = await item.GET(request("GET", `${BASE}/${id}`, key), params(id))
    const body = await byId.json()

    expect(byId.status).toBe(200)
    expect(body).toMatchObject({
      id,
      status: "link_sent",
      timezone: "Europe/Paris",
      customer: { email: "alice.martin@locaz.test", locale: "fr", flowLocale: "fr" },
      contract: { required: true, signed: false, signedPdfUrl: null },
      payment: { currency: "EUR", amount: 15000, depositAmount: 80000, servicePayment: null, deposit: null },
      link: { status: "active", openedAt: null },
    })
    expect(body.steps.map((step: { status: string }) => step.status)).toEqual([
      "pending",
      "skipped",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "skipped",
      "pending",
    ])

    const byRef = await collection.GET(request("GET", `${BASE}?externalRef=LZ-TEST-0001`, key), { params: Promise.resolve({}) })
    expect(byRef.status).toBe(200)
    expect((await byRef.json()).id).toBe(id)
  })

  it("returns the signed PDF URL once the contract is signed", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)
    Object.assign(db.transactions[0]!, {
      signatureRecord: { status: "SIGNED", signedAt: new Date("2026-11-02T08:30:00Z") },
      contractArtifact: { signedPdfUrl: "https://files.contrazy.test/signed.pdf", signedAt: new Date("2026-11-02T08:30:00Z") },
    })

    const body = await (await item.GET(request("GET", `${BASE}/${id}`, key), params(id))).json()

    expect(body.contract).toEqual({
      required: true,
      signed: true,
      signedAt: "2026-11-02T08:30:00.000Z",
      signedPdfUrl: "https://files.contrazy.test/signed.pdf",
    })
    expect(body.steps.find((step: { key: string }) => step.key === "contract")).toMatchObject({
      status: "done",
      completedAt: "2026-11-02T08:30:00.000Z",
    })
  })

  it("returns 404 for another vendor's booking", async () => {
    const { id } = await createBooking(storeKey("vendor_1"))
    const otherKey = storeKey("vendor_2")

    const byId = await item.GET(request("GET", `${BASE}/${id}`, otherKey), params(id))
    expect(byId.status).toBe(404)
    expect((await byId.json()).error.code).toBe("not_found")

    const byRef = await collection.GET(request("GET", `${BASE}?externalRef=LZ-TEST-0001`, otherKey), {
      params: Promise.resolve({}),
    })
    expect(byRef.status).toBe(404)
  })

  it("requires externalRef on the collection GET", async () => {
    const response = await collection.GET(request("GET", BASE, storeKey()), { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
  })
})

describe("PATCH /api/partner/v1/bookings/:id", () => {
  it("changes dates before the customer started and keeps serviceDate on the local date", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)

    const response = await item.PATCH(
      request("PATCH", `${BASE}/${id}`, key, { startAt: "2026-11-03T23:30:00Z", endAt: "2026-11-06T18:00:00+01:00" }),
      params(id)
    )

    expect(response.status).toBe(200)
    expect((await response.json()).startAt).toBe("2026-11-03T23:30:00.000Z")
    expect((db.transactions[0]!.serviceDate as Date).toISOString()).toBe("2026-11-04T00:00:00.000Z")
    expect(launch.prepareVendorTransactionLaunch).toHaveBeenCalledTimes(1)
  })

  it("re-runs the launch checks when steps change", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)

    const response = await item.PATCH(request("PATCH", `${BASE}/${id}`, key, { steps: { checkOut: false } }), params(id))

    expect(response.status).toBe(200)
    expect(launch.prepareVendorTransactionLaunch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(launch.prepareVendorTransactionLaunch).mock.calls[1]?.[0]).toMatchObject({ reconfigureExisting: true })
    expect(db.transactions[0]!.stepSwitches).toMatchObject({ checkIn: true, checkOut: false })
  })

  it("returns 409 booking_locked and writes an audit row once the customer started", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)
    db.transactions[0]!.link = { ...(db.transactions[0]!.link as Row), openedAt: new Date("2026-11-01T10:00:00Z") }

    const response = await item.PATCH(request("PATCH", `${BASE}/${id}`, key, { steps: { checkIn: false } }), params(id))

    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe("booking_locked")
    const audit = db.auditRows.find((row) => row.data.action === "partner_api.booking_locked")
    expect(audit?.data).toMatchObject({
      entityType: "Transaction",
      entityId: id,
      metadata: { vendorId: "vendor_1", fields: ["steps"], requestedStepChanges: ["checkIn"] },
    })
    expect(JSON.stringify(audit)).not.toContain(key)
    expect(db.transactions[0]!.stepSwitches).toMatchObject({ checkIn: true })
  })
})

describe("POST /api/partner/v1/bookings/:id/cancel", () => {
  it("cancels through cancelTransactionLink with the reason", async () => {
    const key = storeKey()
    const { id } = await createBooking(key)

    const response = await cancel.POST(request("POST", `${BASE}/${id}/cancel`, key, { reason: "Customer changed plans" }), params(id))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(links.cancelTransactionLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ linkId: `link_${id}`, actor: "VENDOR", reason: "Customer changed plans" })
    )
    expect(body).toMatchObject({ status: "cancelled", link: { status: "cancelled", cancelReason: "Customer changed plans" } })
  })

  it("requires a reason and refuses another vendor's booking", async () => {
    const { id } = await createBooking(storeKey("vendor_1"))

    const noReason = await cancel.POST(request("POST", `${BASE}/${id}/cancel`, storeKey("vendor_1"), {}), params(id))
    expect(noReason.status).toBe(400)

    const otherVendor = await cancel.POST(
      request("POST", `${BASE}/${id}/cancel`, storeKey("vendor_2"), { reason: "Not mine" }),
      params(id)
    )
    expect(otherVendor.status).toBe(404)
    expect(links.cancelTransactionLink).not.toHaveBeenCalled()
  })
})
