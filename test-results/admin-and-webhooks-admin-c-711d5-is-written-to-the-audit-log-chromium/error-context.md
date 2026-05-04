# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-and-webhooks.spec.ts >> admin can approve a vendor and the action is written to the audit log
- Location: tests\e2e\admin-and-webhooks.spec.ts:16:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Password')

```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test"
  2  | 
  3  | export const E2E_PASSWORD = "Passw0rd!Passw0rd!"
  4  | 
  5  | export const e2eUsers = {
  6  |   admin: "e2e-admin@contrazy.test",
  7  |   pendingVendor: "e2e-pending@contrazy.test",
  8  |   reviewPendingVendor: "e2e-review-pending@contrazy.test",
  9  |   approvedVendor: "e2e-approved@contrazy.test",
  10 | } as const
  11 | 
  12 | export async function loginAs(page: Page, email: string, password = E2E_PASSWORD) {
  13 |   await page.goto("/login")
  14 |   await page.getByLabel("Email").fill(email)
> 15 |   await page.getByLabel("Password").fill(password)
     |                                     ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  16 |   await page.getByRole("button", { name: "Sign In" }).click()
  17 |   await expect(page).not.toHaveURL(/\/login$/)
  18 | }
  19 | 
```