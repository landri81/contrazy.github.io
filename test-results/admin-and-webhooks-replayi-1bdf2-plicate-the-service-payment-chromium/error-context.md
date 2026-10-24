# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-and-webhooks.spec.ts >> replaying the same Stripe webhook does not duplicate the service payment
- Location: tests\e2e\admin-and-webhooks.spec.ts:43:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 1
Received length: 0
Received array:  []
```

# Test source

```ts
  1   | import { loadEnvConfig } from "@next/env"
  2   | import { expect, test } from "@playwright/test"
  3   | import { PrismaClient } from "@prisma/client"
  4   | import Stripe from "stripe"
  5   | 
  6   | import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"
  7   | 
  8   | loadEnvConfig(process.cwd())
  9   | 
  10  | const prisma = new PrismaClient()
  11  | 
  12  | test.afterAll(async () => {
  13  |   await prisma.$disconnect()
  14  | })
  15  | 
  16  | test("admin can approve a vendor and the action is written to the audit log", async ({ page }) => {
  17  |   await loginAs(page, e2eUsers.admin, E2E_PASSWORD)
  18  | 
  19  |   await page.goto("/admin/users/e2e-review-user")
  20  |   await page.getByRole("button", { name: "Approve" }).click()
  21  | 
  22  |   await expect(page.getByText("Review status updated to approved.")).toBeVisible()
  23  | 
  24  |   const profile = await prisma.vendorProfile.findUnique({
  25  |     where: { userId: "e2e-review-user" },
  26  |     select: { reviewStatus: true },
  27  |   })
  28  | 
  29  |   expect(profile?.reviewStatus).toBe("APPROVED")
  30  | 
  31  |   const auditLog = await prisma.auditLog.findFirst({
  32  |     where: {
  33  |       entityType: "VendorProfile",
  34  |       entityId: "e2e-review-vendor",
  35  |       action: "Set vendor review status to APPROVED",
  36  |     },
  37  |     orderBy: { createdAt: "desc" },
  38  |   })
  39  | 
  40  |   expect(auditLog).not.toBeNull()
  41  | })
  42  | 
  43  | test("replaying the same Stripe webhook does not duplicate the service payment", async ({ request }) => {
  44  |   const secret = process.env.STRIPE_WEBHOOK_SECRET
  45  | 
  46  |   expect(secret).toBeTruthy()
  47  | 
  48  |   const eventPayload = JSON.stringify({
  49  |     id: "evt_e2e_checkout_completed",
  50  |     object: "event",
  51  |     type: "checkout.session.completed",
  52  |     data: {
  53  |       object: {
  54  |         id: "cs_e2e_checkout_completed",
  55  |         object: "checkout.session",
  56  |         amount_total: 25000,
  57  |         currency: "eur",
  58  |         payment_intent: "pi_e2e_service_payment",
  59  |         metadata: {
  60  |           vendorId: "e2e-approved-vendor",
  61  |           transactionId: "e2e-webhook-transaction",
  62  |           financeStage: "service_payment",
  63  |         },
  64  |       },
  65  |     },
  66  |   })
  67  | 
  68  |   const signature = Stripe.webhooks.generateTestHeaderString({
  69  |     payload: eventPayload,
  70  |     secret: secret!,
  71  |   })
  72  | 
  73  |   const firstResponse = await request.post("/api/webhooks/stripe", {
  74  |     headers: {
  75  |       "content-type": "text/plain",
  76  |       "stripe-signature": signature,
  77  |     },
  78  |     data: eventPayload,
  79  |   })
  80  | 
  81  |   expect(firstResponse.ok()).toBeTruthy()
  82  | 
  83  |   const replayResponse = await request.post("/api/webhooks/stripe", {
  84  |     headers: {
  85  |       "content-type": "text/plain",
  86  |       "stripe-signature": signature,
  87  |     },
  88  |     data: eventPayload,
  89  |   })
  90  | 
  91  |   expect(replayResponse.ok()).toBeTruthy()
  92  | 
  93  |   const payments = await prisma.payment.findMany({
  94  |     where: {
  95  |       transactionId: "e2e-webhook-transaction",
  96  |       kind: "SERVICE_PAYMENT",
  97  |     },
  98  |   })
  99  | 
> 100 |   expect(payments).toHaveLength(1)
      |                    ^ Error: expect(received).toHaveLength(expected)
  101 |   expect(payments[0]?.status).toBe("SUCCEEDED")
  102 |   expect(payments[0]?.stripeFeeAmount).toBe(0)
  103 |   expect(payments[0]?.platformFeeAmount).toBe(0)
  104 |   expect(payments[0]?.vendorNetAmount).toBe(25000)
  105 | 
  106 |   const webhookEvents = await prisma.transactionEvent.findMany({
  107 |     where: {
  108 |       transactionId: "e2e-webhook-transaction",
  109 |       type: "WEBHOOK_PROCESSED",
  110 |     },
  111 |   })
  112 | 
  113 |   expect(webhookEvents).toHaveLength(1)
  114 | })
  115 | 
```