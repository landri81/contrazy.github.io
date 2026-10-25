import { expect, test } from "@playwright/test"

import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"

const partnerTransactionId = "e2e-partner-booking-transaction"

test("vendor sees the rental card of a partner booking (en)", async ({ page }, testInfo) => {
  await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)
  await page.goto(`/en/vendor/transactions/${partnerTransactionId}`)

  await expect(page.getByText("Rental booking")).toBeVisible()
  await expect(page.getByText("Partner booking")).toBeVisible()
  await expect(page.getByText("LZ-E2E-0001")).toBeVisible()
  await expect(page.getByText("Rental period")).toBeVisible()
  await expect(page.getByText("Peugeot 208").first()).toBeVisible()
  await expect(page.getByText("AB-123-CD")).toBeVisible()
  await expect(page.getByText("Nice Airport T2").first()).toBeVisible()
  // 2 Nov 09:00 to 5 Nov 18:00 Paris time.
  await expect(page.getByText("09:00")).toBeVisible()
  await expect(page.getByText("18:00")).toBeVisible()

  // Viewport shots: a full-page capture resizes the viewport and replays the sidebar margin transition.
  await page.screenshot({ path: testInfo.outputPath("partner-booking-en.png") })
  await page.getByText("Customer steps").scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("partner-booking-en-steps.png") })
})

test("vendor sees the rental card of a partner booking (fr, mobile)", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)
  await page.goto(`/fr/vendor/transactions/${partnerTransactionId}`)

  await expect(page.getByText("LZ-E2E-0001")).toBeVisible()
  await expect(page.getByText("AB-123-CD")).toBeVisible()
  // Dates and amounts in French, like the rest of the page.
  await expect(page.getByText(/lun\. 2 nov\. 2026/)).toBeVisible()
  await expect(page.getByText(/1\s200,00\s€/).first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await page.screenshot({ path: testInfo.outputPath("partner-booking-fr-mobile.png"), fullPage: true })
})
