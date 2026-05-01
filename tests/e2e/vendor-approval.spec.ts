import { expect, test } from "@playwright/test"

import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"

test("pending vendor cannot create live transactions or start Stripe onboarding", async ({ page }) => {
  await loginAs(page, e2eUsers.pendingVendor, E2E_PASSWORD)

  await page.goto("/vendor/actions")

  await expect(page.getByText("Account review in progress")).toBeVisible()
  await expect(page.getByRole("button", { name: "Generate Secure Link" })).toBeDisabled()

  const transactionResponse = await page.evaluate(async () => {
    const response = await fetch("/api/vendor/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Blocked transaction" }),
    })

    return {
      status: response.status,
      payload: await response.json(),
    }
  })

  expect(transactionResponse.status).toBe(403)
  expect(transactionResponse.payload.message).toContain("under review")

  const stripeResponse = await page.evaluate(async () => {
    const response = await fetch("/api/vendor/stripe/connect", {
      method: "POST",
    })

    return {
      status: response.status,
      payload: await response.json(),
    }
  })

  expect(stripeResponse.status).toBe(403)
})

test("approved vendor can create a transaction and cannot use another vendor's template ids", async ({ page }) => {
  await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

  await page.goto("/vendor/actions")
  await page.getByLabel("Transaction Title *").fill("E2E Created Transaction")
  await page.getByRole("button", { name: "Generate Secure Link" }).click()

  await expect(page.getByText("Transaction Created!")).toBeVisible()

  const foreignTemplateResponse = await page.evaluate(async () => {
    const response = await fetch("/api/vendor/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Foreign template attempt",
        contractTemplateId: "e2e-foreign-contract",
        checklistTemplateId: "e2e-foreign-checklist",
      }),
    })

    return {
      status: response.status,
      payload: await response.json(),
    }
  })

  expect(foreignTemplateResponse.status).toBe(422)
  expect(foreignTemplateResponse.payload.message).toContain("not found")
})
