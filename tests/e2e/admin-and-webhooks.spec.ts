import { loadEnvConfig } from "@next/env"
import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"

loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("admin can approve a vendor and the action is written to the audit log", async ({ page }) => {
  await loginAs(page, e2eUsers.admin, E2E_PASSWORD)

  await page.goto("/admin/users/e2e-review-user")
  await page.getByRole("button", { name: "Approve" }).click()

  await expect(page.getByText("Review status updated to approved.")).toBeVisible()

  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: "e2e-review-user" },
    select: { reviewStatus: true },
  })

  expect(profile?.reviewStatus).toBe("APPROVED")

  const auditLog = await prisma.auditLog.findFirst({
    where: {
      entityType: "VendorProfile",
      entityId: "e2e-review-vendor",
      action: "Set vendor review status to APPROVED",
    },
    orderBy: { createdAt: "desc" },
  })

  expect(auditLog).not.toBeNull()
})

test("replaying the same Stripe webhook does not duplicate the service payment", async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  expect(secret).toBeTruthy()

  const eventPayload = JSON.stringify({
    id: "evt_e2e_checkout_completed",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_e2e_checkout_completed",
        object: "checkout.session",
        amount_total: 25000,
        currency: "eur",
        payment_intent: "pi_e2e_service_payment",
        metadata: {
          vendorId: "e2e-approved-vendor",
          transactionId: "e2e-webhook-transaction",
          financeStage: "service_payment",
        },
      },
    },
  })

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: secret!,
  })

  const firstResponse = await request.post("/api/webhooks/stripe", {
    headers: {
      "content-type": "text/plain",
      "stripe-signature": signature,
    },
    data: eventPayload,
  })

  expect(firstResponse.ok()).toBeTruthy()

  const replayResponse = await request.post("/api/webhooks/stripe", {
    headers: {
      "content-type": "text/plain",
      "stripe-signature": signature,
    },
    data: eventPayload,
  })

  expect(replayResponse.ok()).toBeTruthy()

  const payments = await prisma.payment.findMany({
    where: {
      transactionId: "e2e-webhook-transaction",
      kind: "SERVICE_PAYMENT",
    },
  })

  expect(payments).toHaveLength(1)
  expect(payments[0]?.status).toBe("SUCCEEDED")
  expect(payments[0]?.stripeFeeAmount).toBe(0)
  expect(payments[0]?.platformFeeAmount).toBe(0)
  expect(payments[0]?.vendorNetAmount).toBe(25000)

  const webhookEvents = await prisma.transactionEvent.findMany({
    where: {
      transactionId: "e2e-webhook-transaction",
      type: "WEBHOOK_PROCESSED",
    },
  })

  expect(webhookEvents).toHaveLength(1)
})
