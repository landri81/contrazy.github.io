import { expect, test } from "@playwright/test"

import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"

// Synthetic test-mode key seeded for the approved vendor (scripts/seed-e2e.mjs).
const partnerApiKey = `cz_test_${"E2eKey".padEnd(32, "0")}`
const auth = { Authorization: `Bearer ${partnerApiKey}` }
// A public https URL that never resolves: deliveries fail like an unreachable partner.
const endpointUrl = "https://hooks.locaz.test/contrazy"

test("partner endpoint, booking events and resend as the vendor sees them", async ({ page, request }, testInfo) => {
  const created = await request.post("/api/partner/v1/webhook-endpoints", {
    headers: auth,
    data: { url: endpointUrl, description: "LOCAZ booking site" },
  })
  expect(created.status(), await created.text()).toBe(201)
  const endpoint = await created.json()
  // The signing secret is returned once, at creation.
  expect(endpoint.secret).toMatch(/^whsec_/)

  // Private and plain-http URLs are refused in production.
  const privateUrl = await request.post("/api/partner/v1/webhook-endpoints", { headers: auth, data: { url: "https://169.254.169.254/latest" } })
  expect(privateUrl.status()).toBe(422)
  const plainHttp = await request.post("/api/partner/v1/webhook-endpoints", { headers: auth, data: { url: "http://hooks.locaz.test/contrazy" } })
  expect(plainHttp.status()).toBe(422)

  // A booking through the API queues booking.created for the endpoint (outbox).
  const externalRef = `LZ-E2E-WH-${Date.now()}`
  const booking = await request.post("/api/partner/v1/bookings", {
    headers: { ...auth, "Idempotency-Key": externalRef },
    data: {
      externalRef,
      customer: { firstName: "Alice", lastName: "Martin", email: "alice.martin@locaz.test", locale: "fr" },
      startAt: "2026-11-02T09:00:00+01:00",
      endAt: "2026-11-05T18:00:00+01:00",
      rental: {
        vehicle: { model: "Peugeot 208", plate: "AB-123-CD" },
        pickup: { place: "Nice Airport T2" },
        return: { place: "Nice Airport T2" },
        mileage: { unlimited: true },
      },
      contractTemplateId: "e2e-approved-contract",
      steps: { identity: false, documents: false, contract: true, checkIn: false, checkOut: false, payment: false, hold: false },
      returnUrl: `https://locaz.co/account/bookings/${externalRef}`,
    },
  })
  expect(booking.status(), await booking.text()).toBe(201)

  // Test ping: sent now, fails (the host does not resolve) and is recorded.
  const ping = await request.post(`/api/partner/v1/webhook-endpoints/${endpoint.id}/test`, { headers: auth })
  expect(ping.ok()).toBe(true)

  await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)
  await page.goto("/en/vendor/webhooks")
  await expect(page.getByText("Partner endpoints")).toBeVisible()
  await expect(page.getByText(endpointUrl).first()).toBeVisible()
  await expect(page.getByText(endpoint.secret)).toHaveCount(0)
  await expect(page.getByText("booking.created").first()).toBeVisible()
  await expect(page.getByText("ping").first()).toBeVisible()

  await page.getByText("Recent deliveries").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("partner-webhooks-en.png") })

  // Resend the failed ping: still unreachable, reported to the vendor.
  // The test ping failed and is not retried automatically: Failed, not Retrying.
  const pingRow = page.getByRole("row").filter({ hasText: "ping" })
  await expect(pingRow.getByText("Failed")).toBeVisible()
  await pingRow.getByRole("button", { name: "Resend" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Delivery failed again" })).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: testInfo.outputPath("partner-webhooks-resend.png") })
})

test("vendor webhooks page on a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)
  await page.goto("/fr/vendor/webhooks")
  await expect(page.getByText(endpointUrl).first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: testInfo.outputPath("partner-webhooks-fr-mobile.png"), fullPage: true })
})

test("customer finishes a partner booking and is taken back to LOCAZ", async ({ page }, testInfo) => {
  await page.route("https://locaz.co/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>LOCAZ booking</h1>" }))

  await page.goto("/fr/t/e2e-partner-complete/complete")
  const back = page.getByRole("link", { name: "Revenir sur Approved Rentals" })
  await expect(back).toBeVisible()
  await expect(back).toHaveAttribute("href", "https://locaz.co/account/bookings/LZ-E2E-0002?booking=LZ-E2E-0002&status=completed")
  await expect(page.getByText(/Retour sur Approved Rentals dans \d secondes?/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("partner-return-fr.png") })

  // After the 5 s countdown the customer lands on LOCAZ with the booking reference and status.
  await page.waitForURL("https://locaz.co/account/bookings/LZ-E2E-0002?booking=LZ-E2E-0002&status=completed", { timeout: 10_000 })
  await expect(page.getByText("LOCAZ booking")).toBeVisible()
})

test("customer can stay on the completion page", async ({ page }) => {
  await page.goto("/fr/t/e2e-partner-complete/complete")
  await page.getByRole("button", { name: "Rester sur cette page" }).click()
  // Shown on screen, and announced once to screen readers (role=status).
  await expect(page.getByText(/Redirection automatique annulée/).first()).toBeVisible()
  await expect(page.getByRole("status")).toContainText("Redirection automatique annulée")
  await page.waitForTimeout(6_000)
  await expect(page).toHaveURL(/\/t\/e2e-partner-complete\/complete$/)
})
