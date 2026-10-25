/**
 * C5a: saved card, consent log, one Stripe customer per client per vendor.
 * Spec v2.1 §18 scenarios covered here (with the in-memory Stripe gateway):
 *   #1 online paid booking (PaymentIntent + setup_future_usage, card 3155): card saved, ids stored
 *   #2 cash booking (SetupIntent only, card 4242): card saved, nothing charged
 *   #6 card refused at the saving step (0069 / 9995): clear error, card not secured
 */
import type { CardSecurity, ConsentRecord, PartnerCustomer } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const recordCardSecuredEvent = vi.fn()
vi.mock("@/features/partner-webhooks/server/charge-events", () => ({
  recordCardSecuredEvent: (...args: unknown[]) => recordCardSecuredEvent(...args),
}))
// The finance stage module imports e-mail and database helpers this test never calls.
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test" } }))
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/integrations/resend", () => ({}))

const { renderCardConsentText, consentPartiesFor, ConsentPartiesMissingError, CURRENT_CARD_CONSENT_VERSION } = await import(
  "@/features/card-security/consent-texts"
)
const { ensurePartnerCustomer, recordCardConsent, startCardSetup, markCardSecured, trackPendingCardSecurity, CardSecurityError, clientIpFrom } =
  await import("./card-security")
const { createInMemoryStripeGateway } = await import("@/lib/integrations/stripe-gateway")
const { getNextFinanceStage } = await import("@/features/transactions/server/transaction-finance")

const ACCOUNT = "acct_locaz_test"
const LOCAZ = { businessName: "LOCAZ", supportEmail: "contact@locaz.fr", businessEmail: "hello@locaz.co" }

/** The Spec v2.1 §6 French clause, verbatim. */
const SPEC_FR =
  "J'autorise LOCAZ à débiter la carte bancaire enregistrée, sans nouvelle autorisation de ma part, jusqu'à 90 jours après la restitution du véhicule, pour les montants suivants : dommages constatés lors de l'état des lieux de retour, carburant manquant, péages, frais de fourrière, forfaits post-stationnement (FPS) et autres sommes réglées par LOCAZ du fait de la location, y compris lorsqu'ils sont notifiés après la restitution, ainsi que les frais de gestion des contraventions prévus par la grille tarifaire en vigueur. Les amendes pour lesquelles je suis désigné comme conducteur me sont adressées directement par l'administration et ne sont pas débitées par LOCAZ. Chaque débit me sera notifié avec ses justificatifs et je peux le contester auprès de LOCAZ (contact@locaz.fr)."

/** Just the Prisma calls the card-security module makes, in memory. */
function createDb() {
  const customers: PartnerCustomer[] = []
  const consents: ConsentRecord[] = []
  const cards: CardSecurity[] = []
  let seq = 0
  const stamp = () => new Date()

  const db = {
    customers,
    consents,
    cards,
    partnerCustomer: {
      async findUnique({ where }: { where: { vendorId_email: { vendorId: string; email: string } } }) {
        return customers.find((c) => c.vendorId === where.vendorId_email.vendorId && c.email === where.vendorId_email.email) ?? null
      },
      async create({ data }: { data: Omit<PartnerCustomer, "id" | "createdAt" | "updatedAt"> }) {
        if (customers.some((c) => c.vendorId === data.vendorId && c.email === data.email)) throw new Error("Unique constraint failed")
        const row = { ...data, id: `pc_${++seq}`, createdAt: stamp(), updatedAt: stamp() } as PartnerCustomer
        customers.push(row)
        return row
      },
    },
    consentRecord: {
      async create({ data }: { data: Omit<ConsentRecord, "id" | "consentAt"> }) {
        const row = { ...data, id: `cr_${++seq}`, consentAt: stamp() } as ConsentRecord
        consents.push(row)
        return row
      },
      async findFirst({ where }: { where: { transactionId: string } }) {
        return [...consents].reverse().find((c) => c.transactionId === where.transactionId) ?? null
      },
    },
    cardSecurity: {
      async findUnique({ where }: { where: { transactionId: string } }) {
        return cards.find((c) => c.transactionId === where.transactionId) ?? null
      },
      async upsert({ where, create, update }: { where: { transactionId: string }; create: Partial<CardSecurity>; update: Partial<CardSecurity> }) {
        const existing = cards.find((c) => c.transactionId === where.transactionId)
        if (existing) return Object.assign(existing, update, { updatedAt: stamp() })
        const row = { status: "PENDING", setupIntentId: null, paymentIntentId: null, paymentMethodId: null, securedAt: null, ...create, id: `cs_${++seq}`, createdAt: stamp(), updatedAt: stamp() } as CardSecurity
        cards.push(row)
        return row
      },
      async update({ where, data }: { where: { id: string }; data: Partial<CardSecurity> }) {
        const row = cards.find((c) => c.id === where.id)!
        return Object.assign(row, data, { updatedAt: stamp() })
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db)
    },
  }

  return db
}

type Db = ReturnType<typeof createDb>
const asDb = (db: Db) => db as never

const consentTransaction = (id: string) => ({ id, externalRef: `LZ-${id}`, locale: "fr", vendor: LOCAZ })

beforeEach(() => {
  recordCardSecuredEvent.mockReset()
})

describe("consent text (Spec v2.1 §6)", () => {
  it("is the Spec French clause for LOCAZ, with the English translation, a version and a stable hash", () => {
    const text = renderCardConsentText(consentPartiesFor(LOCAZ))

    expect(text.fr).toBe(SPEC_FR)
    expect(text.en).toContain("I authorise LOCAZ to charge my saved payment card, without further authorisation, up to 90 days after the vehicle is returned")
    expect(text.en.endsWith("I may dispute it with LOCAZ (contact@locaz.fr).")).toBe(true)
    expect(text.version).toBe(CURRENT_CARD_CONSENT_VERSION)
    expect(text.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(renderCardConsentText(consentPartiesFor(LOCAZ)).hash).toBe(text.hash)
    expect(text.legalReviewPending).toBe(true)
  })

  it("never names traffic-fine amounts as chargeable, only the admin fee", () => {
    const { fr } = renderCardConsentText(consentPartiesFor(LOCAZ))

    expect(fr).toContain("ne sont pas débitées par LOCAZ")
    expect(fr).toContain("frais de gestion des contraventions")
  })

  it("uses the business e-mail when there is no support e-mail, and refuses a vendor without name or contact", () => {
    expect(consentPartiesFor({ ...LOCAZ, supportEmail: null })).toEqual({ vendorName: "LOCAZ", contactEmail: "hello@locaz.co" })
    expect(() => consentPartiesFor({ businessName: " ", supportEmail: "a@b.c", businessEmail: null })).toThrow(ConsentPartiesMissingError)
    expect(() => consentPartiesFor({ businessName: "LOCAZ", supportEmail: null, businessEmail: null })).toThrow(ConsentPartiesMissingError)
    expect(() => renderCardConsentText(consentPartiesFor(LOCAZ), "card-90d-v0")).toThrow(/Unknown card consent version/)
  })
})

describe("consent log", () => {
  it("stores the exact texts shown, version, hash, IP, browser and booking reference", async () => {
    const db = createDb()
    const record = await recordCardConsent(asDb(db), { transaction: consentTransaction("tx1"), ip: "203.0.113.7", userAgent: "Mozilla/5.0 test" })
    const text = renderCardConsentText(consentPartiesFor(LOCAZ))

    expect(record).toMatchObject({
      transactionId: "tx1",
      termsVersion: text.version,
      textFr: SPEC_FR,
      textEn: text.en,
      textHash: text.hash,
      locale: "fr",
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0 test",
      externalRef: "LZ-tx1",
    })
  })

  it("reads the client IP from the first x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7")
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2")
    expect(clientIpFrom(new Headers())).toBeNull()
  })
})

describe("one Stripe customer per client per vendor (PRD §4.4)", () => {
  it("creates the customer on the vendor's connected account once and reuses it for the next booking", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const first = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "Alice.Martin@locaz.test", name: "Alice Martin", phone: "+33612345678" })
    const second = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: " alice.martin@LOCAZ.test " })

    expect(second.id).toBe(first.id)
    expect(first.email).toBe("alice.martin@locaz.test")
    expect(gateway.paymentsFake.customers(ACCOUNT)).toHaveLength(1)
    expect(gateway.paymentsFake.calls.filter((call) => call.method === "createCustomer")).toEqual([
      expect.objectContaining({ account: ACCOUNT, idempotencyKey: expect.stringMatching(/^partner-customer:v1:[0-9a-f]{32}$/) }),
    ])
  })

  it("keeps customers apart per vendor, and settles a concurrent first booking on one row", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const [a, b] = await Promise.all([
      ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "bob@locaz.test" }),
      ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "bob@locaz.test" }),
    ])
    const other = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v2", stripeAccountId: "acct_other", email: "bob@locaz.test" })

    expect(a.id).toBe(b.id)
    expect(db.customers.filter((c) => c.vendorId === "v1")).toHaveLength(1)
    expect(gateway.paymentsFake.customers(ACCOUNT)).toHaveLength(1)
    expect(other.vendorId).toBe("v2")
  })

  it("refuses without an e-mail", async () => {
    await expect(ensurePartnerCustomer(asDb(createDb()), createInMemoryStripeGateway(), { vendorId: "v1", stripeAccountId: ACCOUNT, email: "  " })).rejects.toMatchObject({
      code: "customer_email_missing",
    })
  })
})

async function setupWithConsent(db: Db, gateway: ReturnType<typeof createInMemoryStripeGateway>, transactionId: string) {
  await recordCardConsent(asDb(db), { transaction: consentTransaction(transactionId), ip: "203.0.113.7", userAgent: "UA" })
  const customer = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "alice@locaz.test" })
  const intent = await startCardSetup(asDb(db), gateway, { transactionId, stripeAccountId: ACCOUNT, partnerCustomer: customer, termsVersion: CURRENT_CARD_CONSENT_VERSION, reference: "TX-1" })
  return { customer, intent }
}

describe("card as security only: SetupIntent (Spec §18 #2)", () => {
  it("saves card 4242 for off-session use without charging anything", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const { customer, intent } = await setupWithConsent(db, gateway, "tx2")

    expect(gateway.paymentsFake.calls.find((call) => call.method === "createSetupIntent")).toMatchObject({
      account: ACCOUNT,
      params: { customer: customer.stripeCustomerId, usage: "off_session", payment_method_types: ["card"], metadata: { transactionId: "tx2", cardSecurity: "true" } },
    })

    const confirmed = gateway.paymentsFake.confirmOnSession("setup_intent", intent.id, ACCOUNT, "pm_card_visa")
    const secured = await markCardSecured(asDb(db), gateway, { transactionId: "tx2", stripeAccountId: ACCOUNT, intent: confirmed as never })

    expect(secured).toMatchObject({ status: "SECURED", setupIntentId: intent.id, paymentMethodId: "pm_card_visa", cardBrand: "visa", cardLast4: "4242", stripeCustomerId: customer.stripeCustomerId })
    expect(secured.securedAt).toBeInstanceOf(Date)
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_visa")?.customer).toBe(customer.stripeCustomerId)
    expect(gateway.paymentsFake.calls.some((call) => call.method === "createPaymentIntent")).toBe(false)
    expect(recordCardSecuredEvent).toHaveBeenCalledTimes(1)
    expect(recordCardSecuredEvent).toHaveBeenCalledWith(db, expect.objectContaining({ transactionId: "tx2" }))
  })

  it("reuses the pending SetupIntent when the page is reloaded", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const { customer, intent } = await setupWithConsent(db, gateway, "tx3")
    const again = await startCardSetup(asDb(db), gateway, { transactionId: "tx3", stripeAccountId: ACCOUNT, partnerCustomer: customer, termsVersion: CURRENT_CARD_CONSENT_VERSION, reference: "TX-1" })

    expect(again.id).toBe(intent.id)
    expect(gateway.paymentsFake.calls.filter((call) => call.method === "createSetupIntent")).toHaveLength(1)
  })

  it("is idempotent: confirming twice records the event once", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const { intent } = await setupWithConsent(db, gateway, "tx4")
    const confirmed = gateway.paymentsFake.confirmOnSession("setup_intent", intent.id, ACCOUNT, "pm_card_threeDSecure2Required")

    await markCardSecured(asDb(db), gateway, { transactionId: "tx4", stripeAccountId: ACCOUNT, intent: confirmed as never })
    const second = await markCardSecured(asDb(db), gateway, { transactionId: "tx4", stripeAccountId: ACCOUNT, intent: confirmed as never })

    expect(second.status).toBe("SECURED")
    expect(second.cardLast4).toBe("3155")
    expect(recordCardSecuredEvent).toHaveBeenCalledTimes(1)
  })
})

describe("card refused at the saving step (Spec §18 #6)", () => {
  it.each([
    ["pm_card_chargeDeclinedExpiredCard", "Your card has expired."],
    ["pm_card_chargeDeclinedInsufficientFunds", "Your card has insufficient funds."],
  ] as const)("%s: the SetupIntent keeps the decline message and the card stays unsecured", async (card, message) => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const { intent } = await setupWithConsent(db, gateway, "tx5")
    const refused = gateway.paymentsFake.confirmOnSession("setup_intent", intent.id, ACCOUNT, card)

    expect(refused.status).toBe("requires_payment_method")
    expect((refused as { last_setup_error: { message: string } }).last_setup_error.message).toBe(message)
    await expect(markCardSecured(asDb(db), gateway, { transactionId: "tx5", stripeAccountId: ACCOUNT, intent: refused as never })).rejects.toMatchObject({
      code: "card_not_saved",
    })
    expect(db.cards[0].status).toBe("PENDING")
    expect(recordCardSecuredEvent).not.toHaveBeenCalled()
  })
})

describe("online paid booking saves the card (Spec §18 #1)", () => {
  it("PaymentIntent with setup_future_usage charges the rental and saves card 3155 for later off-session use", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    await recordCardConsent(asDb(db), { transaction: consentTransaction("tx6"), ip: null, userAgent: null })
    const customer = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "alice@locaz.test" })
    const payment = await gateway.payments.createPaymentIntent(
      { amount: 15000, currency: "eur", customer: customer.stripeCustomerId, setup_future_usage: "off_session", payment_method_types: ["card"], metadata: { transactionId: "tx6", cardSecurity: "true" } },
      { account: ACCOUNT }
    )
    await trackPendingCardSecurity(asDb(db), { transactionId: "tx6", partnerCustomer: customer, paymentIntentId: payment.id })

    const paid = gateway.paymentsFake.confirmOnSession("payment_intent", payment.id, ACCOUNT, "pm_card_threeDSecure2Required")
    const secured = await markCardSecured(asDb(db), gateway, { transactionId: "tx6", stripeAccountId: ACCOUNT, intent: paid as never })

    expect(paid).toMatchObject({ status: "succeeded", amount_received: 15000 })
    expect(secured).toMatchObject({ status: "SECURED", paymentIntentId: payment.id, paymentMethodId: "pm_card_threeDSecure2Required", stripeCustomerId: customer.stripeCustomerId })

    // A later merchant-initiated charge on the saved card goes through (C6 uses this path).
    const later = await gateway.payments.createPaymentIntent(
      { amount: 2500, currency: "eur", customer: customer.stripeCustomerId, payment_method: secured.paymentMethodId!, off_session: true, confirm: true },
      { account: ACCOUNT, idempotencyKey: "postcharge_1_attempt_1" }
    )
    expect(later.status).toBe("succeeded")
  })
})

describe("no consent, no saved card", () => {
  it("refuses to secure a card on a transaction without a consent record", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const customer = await ensurePartnerCustomer(asDb(db), gateway, { vendorId: "v1", stripeAccountId: ACCOUNT, email: "alice@locaz.test" })
    const intent = await startCardSetup(asDb(db), gateway, { transactionId: "tx7", stripeAccountId: ACCOUNT, partnerCustomer: customer, termsVersion: CURRENT_CARD_CONSENT_VERSION, reference: "TX-7" })
    const confirmed = gateway.paymentsFake.confirmOnSession("setup_intent", intent.id, ACCOUNT, "pm_card_visa")

    await expect(markCardSecured(asDb(db), gateway, { transactionId: "tx7", stripeAccountId: ACCOUNT, intent: confirmed as never })).rejects.toBeInstanceOf(CardSecurityError)
    expect(db.cards[0].status).toBe("PENDING")
  })

  it("refuses an intent that belongs to another transaction or another customer", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const { intent } = await setupWithConsent(db, gateway, "tx8")
    const foreign = await gateway.payments.createSetupIntent({ customer: "cus_someone_else", usage: "off_session" }, { account: ACCOUNT })
    const confirmed = gateway.paymentsFake.confirmOnSession("setup_intent", foreign.id, ACCOUNT, "pm_card_visa")

    await expect(markCardSecured(asDb(db), gateway, { transactionId: "tx8", stripeAccountId: ACCOUNT, intent: confirmed as never })).rejects.toMatchObject({ code: "intent_mismatch" })
    expect(intent.id).not.toBe(foreign.id)
  })
})

describe("finance stages with card security", () => {
  const base = {
    amount: null,
    depositAmount: null,
    paymentCollectionTiming: "AFTER_SIGNING",
    servicePaymentRequestedAt: null,
    payments: [],
    depositAuthorization: null,
    cardSecurity: null,
    stepSwitches: { cardSecurity: true },
  }
  const stage = (overrides: Record<string, unknown>) => getNextFinanceStage({ ...base, ...overrides } as never)

  it("asks for the card when nothing is paid online, and completes once it is secured", () => {
    expect(stage({})).toBe("card_security")
    expect(stage({ cardSecurity: { status: "PENDING" } })).toBe("card_security")
    expect(stage({ cardSecurity: { status: "SECURED" } })).toBe("complete")
  })

  it("saves the card with the rental payment when it is paid online now", () => {
    expect(stage({ amount: 15000 })).toBe("service_payment")
    expect(stage({ amount: 15000, payments: [{ kind: "SERVICE_PAYMENT", status: "SUCCEEDED" }], cardSecurity: { status: "SECURED" } })).toBe("complete")
    // Payment went through without saving the card (should not happen): the card step is still asked.
    expect(stage({ amount: 15000, payments: [{ kind: "SERVICE_PAYMENT", status: "SUCCEEDED" }] })).toBe("card_security")
  })

  it("still asks for the card when the rental is paid later (after the service)", () => {
    expect(stage({ amount: 15000, paymentCollectionTiming: "AFTER_SERVICE" })).toBe("card_security")
  })

  it("changes nothing for transactions without card security", () => {
    expect(stage({ stepSwitches: null })).toBe("complete")
    expect(stage({ stepSwitches: { cardSecurity: false }, amount: 5000 })).toBe("service_payment")
  })
})
