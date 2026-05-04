# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: client-flow.spec.ts >> client completes the no-KYC no-payment flow end to end
- Location: tests\e2e\client-flow.spec.ts:5:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.check: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('checkbox', { name: 'I confirm that I accept this agreement' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e7]: Ct
          - generic [ref=e8]:
            - paragraph [ref=e9]: Vendor
            - paragraph [ref=e10]: Approved Rentals
        - generic [ref=e11]:
          - generic [ref=e12]:
            - img [ref=e13]
            - text: Protected session
          - button "Cancel request" [ref=e17] [cursor=pointer]:
            - img
            - text: Cancel request
          - generic [ref=e18]:
            - paragraph [ref=e19]: Reference
            - paragraph [ref=e20]: TX-E2E-FLOW
    - main [ref=e21]:
      - complementary [ref=e22]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - img [ref=e26]
            - text: Secure onboarding
          - generic [ref=e30]:
            - paragraph [ref=e31]: Transaction
            - heading "Complete your request with Approved Rentals" [level=1] [ref=e32]
            - paragraph [ref=e33]: Follow each step in order. Your progress is saved as you move through the secure flow.
          - generic [ref=e34]:
            - generic [ref=e35]:
              - generic [ref=e36]: Current step
              - generic [ref=e37]: 4 of 6
            - generic [ref=e38]:
              - img [ref=e40]
              - generic [ref=e42]:
                - paragraph [ref=e43]: Signature
                - paragraph [ref=e44]: Reference TX-E2E-FLOW
          - generic [ref=e45]:
            - generic [ref=e46]:
              - img [ref=e48]
              - generic [ref=e50]: Profile
            - generic [ref=e51]:
              - img [ref=e53]
              - generic [ref=e55]: Documents
            - generic [ref=e56]:
              - img [ref=e58]
              - generic [ref=e60]: Agreement
            - generic [ref=e61]:
              - generic [ref=e62]: "4"
              - generic [ref=e63]: Signature
      - generic [ref=e64]:
        - generic [ref=e69]:
          - generic [ref=e70]:
            - img [ref=e72]
            - generic [ref=e74]: Profile
          - generic [ref=e75]:
            - img [ref=e77]
            - generic [ref=e79]: Documents
          - generic [ref=e80]:
            - img [ref=e82]
            - generic [ref=e84]: Agreement
          - generic [ref=e85]:
            - img [ref=e87]
            - generic [ref=e89]: Signature
          - generic [ref=e90]:
            - img [ref=e92]
            - generic [ref=e94]: Payment
          - generic [ref=e95]:
            - img [ref=e97]
            - generic [ref=e100]: Complete
        - generic [ref=e103]:
          - generic [ref=e104]:
            - heading "Sign Agreement" [level=2] [ref=e105]
            - paragraph [ref=e106]: Draw your signature to confirm this agreement electronically.
          - generic [ref=e107]:
            - generic [ref=e108]:
              - generic [ref=e109]:
                - img [ref=e111]
                - generic [ref=e113]:
                  - paragraph [ref=e114]: Draw your signature
                  - paragraph [ref=e115]: Use your finger, stylus, or mouse
              - generic [ref=e116]:
                - generic [ref=e117]:
                  - generic:
                    - img
                    - generic:
                      - paragraph: Sign here
                      - paragraph: Mouse, stylus or finger
                - paragraph [ref=e120]: Signature required to continue
            - generic [ref=e121]:
              - img [ref=e122]
              - paragraph [ref=e125]:
                - text: By tapping
                - strong [ref=e126]: Sign and Continue
                - text: ", you confirm your intent to sign electronically. Your signature, name, email, timestamp, and IP address will be recorded."
            - button "Sign and Continue" [disabled]:
              - img
              - text: Sign and Continue
  - alert [ref=e127]: Conntrazy
```

# Test source

```ts
  1  | import { Buffer } from "node:buffer"
  2  | 
  3  | import { expect, test } from "@playwright/test"
  4  | 
  5  | test("client completes the no-KYC no-payment flow end to end", async ({ page }) => {
  6  |   await page.route("**/api/integrations/cloudinary/sign-upload", async (route) => {
  7  |     await route.fulfill({
  8  |       status: 200,
  9  |       contentType: "application/json",
  10 |       body: JSON.stringify({
  11 |         timestamp: 1234567890,
  12 |         signature: "e2e-signature",
  13 |         apiKey: "e2e-api-key",
  14 |         cloudName: "e2e-cloud",
  15 |       }),
  16 |     })
  17 |   })
  18 | 
  19 |   await page.route("https://api.cloudinary.com/v1_1/**/auto/upload", async (route) => {
  20 |     await route.fulfill({
  21 |       status: 200,
  22 |       contentType: "application/json",
  23 |       body: JSON.stringify({
  24 |         secure_url: "https://example.com/assets/id.pdf",
  25 |         public_id: "e2e/id",
  26 |       }),
  27 |     })
  28 |   })
  29 | 
  30 |   await page.goto("/t/e2e-client-flow")
  31 |   await expect(page).toHaveURL(/\/t\/e2e-client-flow\/profile$/)
  32 | 
  33 |   await page.getByLabel("Full Name *").fill("E2E Client")
  34 |   await page.getByLabel("Email Address *").fill("client@contrazy.test")
  35 |   await page.getByLabel("Phone Number").fill("+33111111111")
  36 |   const profileResponse = page.waitForResponse("**/api/client/e2e-client-flow/profile")
  37 |   await page.getByRole("button", { name: "Continue" }).click()
  38 |   await profileResponse
  39 | 
  40 |   await expect(page).toHaveURL(/\/t\/e2e-client-flow\/documents$/, { timeout: 20_000 })
  41 | 
  42 |   await page.locator('input[type="file"]').setInputFiles({
  43 |     name: "identity.pdf",
  44 |     mimeType: "application/pdf",
  45 |     buffer: Buffer.from("e2e-pdf"),
  46 |   })
  47 | 
  48 |   await expect(page.getByText("identity.pdf")).toBeVisible()
  49 |   const documentsResponse = page.waitForResponse("**/api/client/e2e-client-flow/documents")
  50 |   await page.getByRole("button", { name: "Continue" }).click()
  51 |   await documentsResponse
  52 | 
  53 |   await expect(page).toHaveURL(/\/t\/e2e-client-flow\/contract$/, { timeout: 20_000 })
  54 |   await page.getByRole("checkbox", { name: "I have reviewed this agreement" }).check()
  55 |   const contractResponse = page.waitForResponse("**/api/client/e2e-client-flow/contract")
  56 |   await page.getByRole("button", { name: "Continue to Signature" }).click()
  57 |   await contractResponse
  58 | 
  59 |   await expect(page).toHaveURL(/\/t\/e2e-client-flow\/sign$/, { timeout: 20_000 })
> 60 |   await page.getByRole("checkbox", { name: "I confirm that I accept this agreement" }).check()
     |                                                                                        ^ Error: locator.check: Test timeout of 60000ms exceeded.
  61 |   const signatureResponse = page.waitForResponse("**/api/client/e2e-client-flow/sign")
  62 |   await page.getByRole("button", { name: "Sign and Continue" }).click()
  63 |   await signatureResponse
  64 | 
  65 |   await expect(page).toHaveURL(/\/t\/e2e-client-flow\/complete$/, { timeout: 20_000 })
  66 |   await expect(page.getByText("You're All Set!")).toBeVisible()
  67 | })
  68 | 
```