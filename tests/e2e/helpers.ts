import { expect, type Page } from "@playwright/test"

export const E2E_PASSWORD = "Passw0rd!Passw0rd!"

export const e2eUsers = {
  admin: "e2e-admin@contrazy.test",
  pendingVendor: "e2e-pending@contrazy.test",
  reviewPendingVendor: "e2e-review-pending@contrazy.test",
  approvedVendor: "e2e-approved@contrazy.test",
} as const

export async function loginAs(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
