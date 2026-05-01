import { Buffer } from "node:buffer"

import { expect, test } from "@playwright/test"

test("client completes the no-KYC no-payment flow end to end", async ({ page }) => {
  await page.route("**/api/integrations/cloudinary/sign-upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        timestamp: 1234567890,
        signature: "e2e-signature",
        apiKey: "e2e-api-key",
        cloudName: "e2e-cloud",
      }),
    })
  })

  await page.route("https://api.cloudinary.com/v1_1/**/auto/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        secure_url: "https://example.com/assets/id.pdf",
        public_id: "e2e/id",
      }),
    })
  })

  await page.goto("/t/e2e-client-flow")
  await expect(page).toHaveURL(/\/t\/e2e-client-flow\/profile$/)

  await page.getByLabel("Full Name *").fill("E2E Client")
  await page.getByLabel("Email Address *").fill("client@contrazy.test")
  await page.getByLabel("Phone Number").fill("+33111111111")
  const profileResponse = page.waitForResponse("**/api/client/e2e-client-flow/profile")
  await page.getByRole("button", { name: "Continue" }).click()
  await profileResponse

  await expect(page).toHaveURL(/\/t\/e2e-client-flow\/documents$/, { timeout: 20_000 })

  await page.locator('input[type="file"]').setInputFiles({
    name: "identity.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("e2e-pdf"),
  })

  await expect(page.getByText("identity.pdf")).toBeVisible()
  const documentsResponse = page.waitForResponse("**/api/client/e2e-client-flow/documents")
  await page.getByRole("button", { name: "Continue" }).click()
  await documentsResponse

  await expect(page).toHaveURL(/\/t\/e2e-client-flow\/contract$/, { timeout: 20_000 })
  await page.getByRole("checkbox", { name: "I have reviewed this agreement" }).check()
  const contractResponse = page.waitForResponse("**/api/client/e2e-client-flow/contract")
  await page.getByRole("button", { name: "Continue to Signature" }).click()
  await contractResponse

  await expect(page).toHaveURL(/\/t\/e2e-client-flow\/sign$/, { timeout: 20_000 })
  await page.getByRole("checkbox", { name: "I confirm that I accept this agreement" }).check()
  const signatureResponse = page.waitForResponse("**/api/client/e2e-client-flow/sign")
  await page.getByRole("button", { name: "Sign and Continue" }).click()
  await signatureResponse

  await expect(page).toHaveURL(/\/t\/e2e-client-flow\/complete$/, { timeout: 20_000 })
  await expect(page.getByText("You're All Set!")).toBeVisible()
})
