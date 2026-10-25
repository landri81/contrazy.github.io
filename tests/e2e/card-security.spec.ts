import { PrismaClient } from "@prisma/client"
import { expect, test } from "@playwright/test"

// Synthetic test-mode key seeded for the approved vendor (scripts/seed-e2e.mjs).
const auth = { Authorization: `Bearer cz_test_${"E2eKey".padEnd(32, "0")}` }
const prisma = new PrismaClient()

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("the partner API accepts steps.cardSecurity and reports it as a pending step", async ({ request }) => {
  const externalRef = `LZ-E2E-CS-${Date.now()}`
  const response = await request.post("/api/partner/v1/bookings", {
    headers: { ...auth, "Idempotency-Key": externalRef },
    data: {
      externalRef,
      customer: { firstName: "Alice", lastName: "Martin", email: "alice.martin@locaz.test", locale: "fr" },
      startAt: "2026-11-02T09:00:00+01:00",
      endAt: "2026-11-05T18:00:00+01:00",
      rental: { vehicle: { model: "Peugeot 208" }, pickup: { place: "Nice Airport T2" }, return: { place: "Nice Airport T2" }, mileage: { unlimited: true } },
      steps: { identity: false, documents: false, contract: false, checkIn: false, checkOut: false, payment: false, hold: false, cardSecurity: true },
      returnUrl: `https://locaz.co/account/bookings/${externalRef}`,
    },
  })

  expect(response.status(), await response.text()).toBe(201)
  const booking = await response.json()
  const steps = booking.steps ?? booking.stepProgress ?? []
  expect(steps).toEqual(expect.arrayContaining([expect.objectContaining({ key: "cardSecurity", required: true, status: "pending" })]))
})

test("customer accepts the card terms before any card form (fr)", async ({ page, request }, testInfo) => {
  // No card form, no SetupIntent before consent.
  const early = await request.post("/api/client/e2e-card-security/card-security/setup-intent")
  expect(early.status()).toBe(409)
  expect((await early.json()).code).toBe("consent_required")

  await page.goto("/fr/t/e2e-card-security/payment")
  await expect(page.getByRole("heading", { name: "Enregistrez votre carte" })).toBeVisible()

  // The binding French clause, naming the vendor and its contact; no translation for a French customer.
  const clause = page.locator('blockquote[lang="fr"]')
  await expect(clause).toContainText("J'autorise Approved Rentals à débiter la carte bancaire enregistrée, sans nouvelle autorisation de ma part, jusqu'à 90 jours")
  await expect(clause).toContainText("(support+e2e-approved-vendor@contrazy.test).")
  await expect(page.locator('p[lang="en"]')).toHaveCount(0)

  const box = page.getByRole("checkbox", { name: "J’ai lu et j’accepte ces conditions pour ma carte enregistrée." })
  const accept = page.getByRole("button", { name: "Accepter et continuer" })
  await expect(box).not.toBeChecked()
  await expect(accept).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath("card-consent-fr.png"), fullPage: true })

  await box.click()
  await expect(accept).toBeEnabled()
  const consentSaved = page.waitForResponse("**/card-security/consent")
  await accept.click()
  expect((await consentSaved).status()).toBe(200)

  // The consent is logged server-side with the exact text, version, hash, IP and browser.
  const consent = await prisma.consentRecord.findFirst({ where: { transactionId: "e2e-card-security-transaction" } })
  expect(consent).toMatchObject({ termsVersion: "card-90d-v1", locale: "fr", externalRef: "LZ-E2E-CARD" })
  expect(consent?.textFr).toContain("J'autorise Approved Rentals")
  expect(consent?.textHash).toMatch(/^[0-9a-f]{64}$/)
  expect(consent?.ip).toBeTruthy()
  expect(consent?.userAgent).toContain("Mozilla")

  // Then the card form loads (E2E has no real Stripe keys, so it stops at a clear error).
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  await expect(page.getByText(/Préparation du formulaire de carte sécurisé|Le formulaire de carte n’a pas pu être chargé/)).toBeVisible()

  // Reloading never asks again.
  await page.reload()
  await expect(page.getByRole("button", { name: "Accepter et continuer" })).toHaveCount(0)
})

test("an English-speaking customer sees the French clause with the English translation (phone)", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/en/t/e2e-card-security-en/payment")

  await expect(page.getByRole("heading", { name: "Secure your card" })).toBeVisible()
  await expect(page.locator('blockquote[lang="fr"]')).toContainText("J'autorise Approved Rentals")
  await expect(page.getByText("English translation (for information)")).toBeVisible()
  await expect(page.locator('p[lang="en"]')).toContainText("I authorise Approved Rentals to charge my saved payment card, without further authorisation, up to 90 days")
  await expect(page.getByRole("checkbox")).not.toBeChecked()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: testInfo.outputPath("card-consent-en-mobile.png"), fullPage: true })
})

test("pickup hold endpoints refuse cleanly before any card is saved (C5b)", async ({ request }) => {
  const hold = "/api/partner/v1/bookings/e2e-card-security-transaction-en/hold"
  const withKey = (key: string) => ({ ...auth, "Idempotency-Key": `${key}-${Date.now()}` })

  const noKey = await request.post(hold, { headers: auth, data: { amount: 80000 } })
  expect(noKey.status()).toBe(400)
  expect((await noKey.json()).error.code).toBe("idempotency_key_required")

  const badAmount = await request.post(hold, { headers: withKey("bad"), data: { amount: -5 } })
  expect(badAmount.status()).toBe(400)
  expect((await badAmount.json()).error.code).toBe("invalid_request")

  const noCard = await request.post(hold, { headers: withKey("nocard"), data: { amount: 80000 } })
  expect(noCard.status(), await noCard.text()).toBe(409)
  expect((await noCard.json()).error.code).toBe("card_not_secured")

  for (const action of ["capture", "cancel"]) {
    const settle = await request.post(`${hold}/${action}`, { headers: withKey(action), data: {} })
    expect(settle.status(), await settle.text()).toBe(409)
    expect((await settle.json()).error.code).toBe("hold_not_active")
  }

  const foreign = await request.post("/api/partner/v1/bookings/does-not-exist/hold", { headers: withKey("foreign"), data: { amount: 80000 } })
  expect(foreign.status()).toBe(404)
})

test("return date, 90-day window and detach rules on a booking with a saved card (C5c)", async ({ request }) => {
  const bookingUrl = "/api/partner/v1/bookings/e2e-card-secured-transaction"

  const before = await (await request.get(bookingUrl, { headers: auth })).json()
  expect(before.cardSecurity).toMatchObject({ status: "secured", windowEndsAt: null, detachedAt: null })
  // No card data in partner responses.
  expect(JSON.stringify(before)).not.toMatch(/pm_e2e_secured|4242|visa/)
  const detachUrl = `/api/partner/v1/customers/${before.cardSecurity.customerId}/detach-card`

  const notReturned = await request.post(detachUrl, { headers: auth, data: {} })
  expect(notReturned.status()).toBe(409)
  expect((await notReturned.json()).error).toMatchObject({ code: "card_in_use", details: { blockingBookings: [expect.objectContaining({ id: "e2e-card-secured-transaction", reason: "not_returned" })] } })

  const future = await request.post(`${bookingUrl}/returned`, { headers: auth, data: { returnedAt: new Date(Date.now() + 86_400_000).toISOString() } })
  expect(future.status()).toBe(400)

  const returnedAt = "2026-10-20T18:00:00+02:00"
  const returned = await request.post(`${bookingUrl}/returned`, { headers: auth, data: { returnedAt } })
  expect(returned.status(), await returned.text()).toBe(200)
  expect((await returned.json()).cardSecurity.windowEndsAt).toBe(new Date(new Date(returnedAt).getTime() + 90 * 86_400_000).toISOString())

  const inWindow = await request.post(detachUrl, { headers: auth, data: {} })
  expect(inWindow.status()).toBe(409)
  expect((await inWindow.json()).error.details.blockingBookings[0].reason).toBe("charge_window_open")

  expect((await request.post("/api/partner/v1/customers/unknown-customer/detach-card", { headers: auth, data: {} })).status()).toBe(404)
  expect((await request.post("/api/partner/v1/bookings/e2e-card-security-transaction/returned", { headers: auth, data: { returnedAt } })).status()).toBe(409)
  // The daily detach job only answers Vercel Cron.
  expect((await request.get("/api/cron/card-security")).status()).toBe(401)
})

test("post-rental charge endpoints check the hard rules before any Stripe call (C6a)", async ({ request }) => {
  const withKey = (key: string) => ({ ...auth, "Idempotency-Key": `${key}-${Date.now()}` })
  const charges = (booking: string) => `/api/partner/v1/bookings/${booking}/charges`

  const noKey = await request.post(charges("e2e-card-secured-transaction"), { headers: auth, data: { type: "damage", amount: 25000 } })
  expect((await noKey.json()).error.code).toBe("idempotency_key_required")

  const badType = await request.post(charges("e2e-card-secured-transaction"), { headers: withKey("type"), data: { type: "speeding_fine", amount: 9000 } })
  expect(badType.status()).toBe(400)

  const noCard = await request.post(charges("e2e-card-security-transaction-en"), { headers: withKey("nocard"), data: { type: "damage", amount: 25000 } })
  expect(noCard.status()).toBe(409)
  expect((await noCard.json()).error.code).toBe("card_not_secured")

  for (const type of ["fps", "toll", "towing"]) {
    const noProof = await request.post(charges("e2e-card-secured-transaction"), { headers: withKey(type), data: { type, amount: 3500 } })
    expect(noProof.status(), await noProof.text()).toBe(422)
    expect((await noProof.json()).error.code).toBe("proof_required")
  }

  expect((await request.get("/api/partner/v1/charges/unknown-charge", { headers: auth })).status()).toBe(404)
  const booking = await (await request.get("/api/partner/v1/bookings/e2e-card-secured-transaction", { headers: auth })).json()
  expect(booking.charges).toEqual([])
})
