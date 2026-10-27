/**
 * C7: the partner API documentation stays true to the code.
 * - docs/partner-api/openapi.yaml documents every /api/partner/v1 route and method, and nothing else; refs resolve;
 *   every error code the code can return is documented.
 * - docs/partner-api/fixtures/requests/*.json parse with the routes' own zod schemas.
 * - docs/partner-api/fixtures/webhooks/*.json and responses/*.json are generated from the real payload builder
 *   and presenters: regenerate with `UPDATE_PARTNER_FIXTURES=1 npx vitest run src/features/partner-api/docs.test.ts`.
 */
import fs from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"
import { parse } from "yaml"

vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://contrazy.com" } }))

const { partnerBookingCancelSchema, partnerBookingCreateSchema, partnerBookingUpdateSchema } = await import("@/features/partner-api/schemas/booking.schema")
const {
  partnerBookingRefundSchema,
  partnerBookingReturnedSchema,
  partnerChargeCreateSchema,
  partnerChargeRefundSchema,
  partnerDetachCardSchema,
  partnerHoldCancelSchema,
  partnerHoldCaptureSchema,
  partnerHoldCreateSchema,
} = await import("@/features/partner-api/schemas/card-charges.schema")
const { partnerWebhookEndpointCreateSchema } = await import("@/features/partner-webhooks/schemas/endpoint.schema")
const {
  partnerCheckoutCardConfirmSchema,
  partnerCheckoutCardConsentSchema,
  partnerCheckoutContractAcceptSchema,
  partnerCheckoutDocumentsSubmitSchema,
  partnerCheckoutIdentitySchema,
  partnerCheckoutPaymentConfirmSchema,
  partnerCheckoutSignatureSchema,
} = await import("@/features/partner-api/schemas/checkout.schema")
const { buildPartnerBookingRecord } = await import("@/features/partner-webhooks/__fixtures__/partner-booking")
const { buildPartnerPingPayload, buildPartnerWebhookPayload } = await import("@/features/partner-webhooks/payload")
const { presentCreatedPartnerBooking, presentPartnerBooking, presentPartnerCharge } = await import("@/features/partner-api/booking-presenter")
const { PARTNER_WEBHOOK_EVENT_TYPES } = await import("@/lib/partner-webhooks/catalogue")

const ROOT = process.cwd()
const DOCS = path.join(ROOT, "docs", "partner-api")
const ROUTES = path.join(ROOT, "src", "app", "api", "partner", "v1")
const UPDATE = process.env.UPDATE_PARTNER_FIXTURES === "1"
const BASE_URL = "https://contrazy.com"

type OpenApi = { openapi: string; paths: Record<string, Record<string, unknown>>; components: Record<string, Record<string, unknown>> }
const openapi = parse(fs.readFileSync(path.join(DOCS, "openapi.yaml"), "utf8")) as OpenApi

function implementedOperations() {
  const operations: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "route.ts") {
        const source = fs.readFileSync(full, "utf8")
        const route = "/" + path.relative(ROUTES, dir).split(path.sep).filter(Boolean).map((part) => part.replace(/^\[(.+)\]$/, "{$1}")).join("/")
        for (const [, method] of source.matchAll(/^export (?:const|async function) (GET|POST|PATCH|PUT|DELETE)\b/gm)) {
          operations.push(`${method} ${route === "/" ? "/" : route}`)
        }
      }
    }
  }
  walk(ROUTES)
  return operations.sort()
}

function documentedOperations() {
  return Object.entries(openapi.paths)
    .flatMap(([route, item]) => Object.keys(item).filter((key) => ["get", "post", "patch", "put", "delete"].includes(key)).map((method) => `${method.toUpperCase()} ${route}`))
    .sort()
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

/** Compares a generated fixture with the committed file, or writes it with UPDATE_PARTNER_FIXTURES=1. */
function expectFixture(relative: string, value: unknown) {
  const file = path.join(DOCS, "fixtures", relative)
  const json = JSON.stringify(value, null, 2) + "\n"

  if (UPDATE) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, json)
  }

  expect(fs.existsSync(file), `${relative} is missing: run with UPDATE_PARTNER_FIXTURES=1`).toBe(true)
  expect(readJson(file)).toEqual(JSON.parse(json))
}

describe("openapi.yaml", () => {
  it("is OpenAPI 3.1 at API version 2026-11-01", () => {
    expect(openapi.openapi).toBe("3.1.0")
    expect((openapi as unknown as { info: { version: string } }).info.version).toBe("2026-11-01")
  })

  it("documents every partner route and method, and only those", () => {
    expect(documentedOperations()).toEqual(implementedOperations())
  })

  it("resolves every $ref", () => {
    const refs = [...JSON.stringify(openapi).matchAll(/"\$ref":"#\/components\/([^/]+)\/([^"]+)"/g)]
    expect(refs.length).toBeGreaterThan(20)
    for (const [, group, name] of refs) expect(openapi.components[group]?.[name], `${group}/${name}`).toBeDefined()
  })

  it("lists every error code the API can return", () => {
    const source = fs.readFileSync(path.join(ROOT, "src", "lib", "partner-api", "errors.ts"), "utf8")
    const codes = [...source.slice(source.indexOf("export type PartnerApiErrorCode"), source.indexOf("export type PartnerApiErrorBody")).matchAll(/\| "([a-z_]+)"/g)].map(([, code]) => code)
    const documented = ((openapi.components.schemas.Error as { properties: { error: { properties: { code: { enum: string[] } } } } }).properties.error.properties.code.enum)
    expect([...documented].sort()).toEqual([...codes].sort())
  })

  it("lists the whole webhook catalogue", () => {
    const documented = (openapi.components.schemas.WebhookEventType as { enum: string[] }).enum
    expect(documented).toEqual([...PARTNER_WEBHOOK_EVENT_TYPES])
  })
})

describe("request fixtures parse with the routes' schemas", () => {
  const schemas = {
    "bookings.create.json": partnerBookingCreateSchema,
    "bookings.update.json": partnerBookingUpdateSchema,
    "bookings.cancel.json": partnerBookingCancelSchema,
    "bookings.hold.json": partnerHoldCreateSchema,
    "bookings.hold-capture.json": partnerHoldCaptureSchema,
    "bookings.hold-cancel.json": partnerHoldCancelSchema,
    "bookings.returned.json": partnerBookingReturnedSchema,
    "bookings.charges.json": partnerChargeCreateSchema,
    "charges.refunds.json": partnerChargeRefundSchema,
    "bookings.refunds.json": partnerBookingRefundSchema,
    "customers.detach-card.json": partnerDetachCardSchema,
    "webhook-endpoints.create.json": partnerWebhookEndpointCreateSchema,
    "bookings.checkout-documents.json": partnerCheckoutDocumentsSubmitSchema,
    "bookings.checkout-identity.json": partnerCheckoutIdentitySchema,
    "bookings.checkout-contract-accept.json": partnerCheckoutContractAcceptSchema,
    "bookings.checkout-signature.json": partnerCheckoutSignatureSchema,
    "bookings.checkout-payment-confirm.json": partnerCheckoutPaymentConfirmSchema,
    "bookings.checkout-card-consent.json": partnerCheckoutCardConsentSchema,
    "bookings.checkout-card-confirm.json": partnerCheckoutCardConfirmSchema,
  } as const

  it("has one fixture per request body, and no other", () => {
    expect(fs.readdirSync(path.join(DOCS, "fixtures", "requests")).sort()).toEqual(Object.keys(schemas).sort())
  })

  it.each(Object.entries(schemas))("%s", (file, schema) => {
    const result = schema.safeParse(readJson(path.join(DOCS, "fixtures", "requests", file)))
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
  })
})

/** The synthetic booking behind the generated fixtures (no real data). */
function sampleBooking(overrides: Record<string, unknown> = {}) {
  const booking = buildPartnerBookingRecord({
    clientProfile: { ...buildPartnerBookingRecord().clientProfile!, firstName: "Alice", lastName: "Martin", fullName: "Alice Martin", email: "alice.martin@locaz.test", phone: "+33612345678" },
    reports: [],
    reportFields: [],
    locale: "fr",
    stepSwitches: { identity: true, selfie: false, documents: false, contract: true, checkIn: false, checkOut: false, payment: true, cardSecurity: true, hold: false },
    ...overrides,
  } as never)
  return {
    ...booking,
    rentalDetails: {
      vehicle: { model: "Peugeot 208", plate: "AB-123-CD", category: "Compact" },
      pickup: { place: "Nice Airport T2" },
      return: { place: "Nice Airport T2" },
      mileage: { unlimited: false, includedKm: 900, extraKmPrice: 25 },
      options: [],
      priceLines: [],
    },
    partnerMetadata: null,
    createdAt: new Date("2026-11-01T07:00:00.000Z"),
    updatedAt: new Date("2026-11-20T10:00:00.000Z"),
    cardSecurity: {
      id: "cs_1",
      transactionId: booking.id,
      partnerCustomerId: "pcus_1",
      stripeCustomerId: "cus_hidden",
      status: "SECURED",
      setupIntentId: null,
      paymentIntentId: "pi_hidden",
      paymentMethodId: "pm_hidden",
      cardBrand: "visa",
      cardLast4: "4242",
      cardExpMonth: 12,
      cardExpYear: 2030,
      securedAt: new Date("2026-11-04T18:00:00.000Z"),
      windowEndsAt: new Date("2027-02-06T17:00:00.000Z"),
      detachedAt: null,
      createdAt: new Date("2026-11-04T17:59:00.000Z"),
      updatedAt: new Date("2026-11-04T18:00:00.000Z"),
    },
    postCharges: [sampleCharge()],
  } as never
}

function sampleCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: "pc_1",
    transactionId: "txn_partner_1",
    vendorId: "vendor_1",
    externalRef: "LZ-FPS-0617",
    type: "FPS",
    amount: 3500,
    currency: "EUR",
    description: "FPS Nice, 12 Nov",
    proofUrls: ["https://files.locaz.co/fps-0617.pdf"],
    status: "SUCCEEDED",
    attempt: 1,
    paymentIntentId: "pi_hidden",
    declineCode: null,
    nextRetryAt: null,
    paymentLinkToken: null,
    reviewFlag: false,
    refundedAmount: 0,
    succeededAt: new Date("2026-11-20T10:00:00.000Z"),
    createdById: null,
    createdAt: new Date("2026-11-20T10:00:00.000Z"),
    updatedAt: new Date("2026-11-20T10:00:00.000Z"),
    ...overrides,
  } as never
}

/** Event metadata as the timeline records it for each type (charge and refund facts come from charge-events.ts). */
const EVENT_METADATA: Record<string, Record<string, unknown>> = {
  "booking.card_secured": { usage: "off_session" },
  "booking.cancelled": { actor: "PARTNER" },
  "charge.succeeded": { chargeId: "pc_1", externalRef: "LZ-FPS-0617", type: "fps", amount: 3500, currency: "EUR", status: "succeeded", attempt: 1, declineCode: null, nextRetryAt: null, paymentLinkUrl: null, cardUpdateUrl: null },
  "charge.failed": { chargeId: "pc_2", externalRef: "LZ-DMG-0001", type: "damage", amount: 25000, currency: "EUR", status: "failed", attempt: 1, declineCode: "insufficient_funds", nextRetryAt: "2026-11-21T10:00:00.000Z", paymentLinkUrl: null, cardUpdateUrl: null },
  "charge.requires_action": { chargeId: "pc_3", externalRef: "LZ-TOLL-0002", type: "toll", amount: 870, currency: "EUR", status: "requires_action", attempt: 1, declineCode: "authentication_required", nextRetryAt: null, paymentLinkUrl: "https://contrazy.com/fr/pay/Q2hhcmdlTGlua1Rva2VuLUV4YW1wbGU", cardUpdateUrl: null },
  "refund.succeeded": { refundId: "pcr_1", chargeId: "pc_1", amount: 1500, currency: "EUR", reason: "FPS reduced on appeal" },
  "booking.payment_refunded": { refundId: "prf_1", amount: 12000, currency: "EUR", reason: "Cancelled 30 hours before pickup: 50 % refund" },
}

/** C8: a chargeback through its life, for the dispute.* examples (never the Stripe id or the evidence). */
function sampleDispute(overrides: Record<string, unknown> = {}) {
  return {
    id: "dsp_1",
    transactionId: "txn_partner_1",
    kind: "CHARGEBACK",
    status: "OPEN",
    summary: "PII_SENTINEL summary",
    evidenceImages: [],
    resolution: null,
    resolvedByAdminId: null,
    reason: "product_unacceptable",
    amount: 15000,
    currency: "eur",
    evidenceDueBy: new Date("2026-12-04T23:59:59.000Z"),
    stripeDisputeId: "dp_hidden",
    openedAt: new Date("2026-11-20T08:15:00.000Z"),
    resolvedAt: null,
    ...overrides,
  }
}

const DISPUTE_STATES: Record<string, Record<string, unknown>> = {
  "dispute.opened": {},
  "dispute.updated": { status: "UNDER_REVIEW" },
  "dispute.closed": { status: "RESOLVED", resolvedAt: new Date("2026-12-12T10:00:00.000Z") },
}

describe("generated webhook and response fixtures", () => {
  it.each([...PARTNER_WEBHOOK_EVENT_TYPES])("webhooks/%s.json", (type) => {
    const payload = buildPartnerWebhookPayload({
      eventId: `evt_${type.replace(/\W/g, "_")}_example`,
      type,
      booking: sampleBooking(DISPUTE_STATES[type] ? { dispute: sampleDispute(DISPUTE_STATES[type]) } : {}),
      event: { type: type.toUpperCase(), occurredAt: new Date("2026-11-05T09:30:00.000Z"), metadata: (EVENT_METADATA[type] ?? null) as never },
      baseUrl: BASE_URL,
    })
    expect(payload.apiVersion).toBe("2026-11-01")
    expect(JSON.stringify(payload)).not.toMatch(/PII_SENTINEL|pi_hidden|pm_hidden|cus_hidden|dp_hidden|4242/)
    expectFixture(`webhooks/${type}.json`, payload)
  })

  it("webhooks/ping.json", () => {
    expectFixture("webhooks/ping.json", buildPartnerPingPayload({ eventId: "evt_ping_example", endpointId: "we_1", createdAt: new Date("2026-11-05T09:30:00.000Z") }))
  })

  it("responses: booking created, booking, charges", () => {
    expectFixture("responses/bookings.create.201.json", presentCreatedPartnerBooking(sampleBooking({ link: { ...buildPartnerBookingRecord().link!, token: "customer-link-token", qrCodeSvg: null } }), BASE_URL))
    const booking = presentPartnerBooking(sampleBooking({ link: { ...buildPartnerBookingRecord().link!, token: "customer-link-token" } }), BASE_URL)
    expect(JSON.stringify(booking)).not.toMatch(/PII_SENTINEL|pi_hidden|pm_hidden|cus_hidden|4242/)
    expect(booking.customerUrl).toBe("https://contrazy.com/fr/t/customer-link-token")
    expectFixture("responses/bookings.get.200.json", booking)
    expectFixture("responses/bookings.charges.201.json", presentPartnerCharge(sampleCharge()))
    expectFixture(
      "responses/bookings.charges.201.failed.json",
      presentPartnerCharge(sampleCharge({ id: "pc_2", externalRef: "LZ-DMG-0001", type: "DAMAGE", amount: 25000, description: "Rear bumper scratch", proofUrls: [], status: "FAILED", declineCode: "insufficient_funds", nextRetryAt: new Date("2026-11-21T10:00:00.000Z"), succeededAt: null }))
    )
  })

  it("has one fixture per webhook type and nothing stale", () => {
    expect(fs.readdirSync(path.join(DOCS, "fixtures", "webhooks")).sort()).toEqual([...PARTNER_WEBHOOK_EVENT_TYPES, "ping"].map((type) => `${type}.json`).sort())
  })
})
