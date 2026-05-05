import { randomUUID } from "node:crypto"

import { loadEnvConfig } from "@next/env"
import { expect, test } from "@playwright/test"
import { PaymentKind, PrismaClient } from "@prisma/client"
import Stripe from "stripe"

import { E2E_PASSWORD, e2eUsers, loginAs } from "./helpers"

loadEnvConfig(process.cwd())

const prisma = new PrismaClient()
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const hasStripeSecretKey = Boolean(stripeSecretKey?.startsWith("sk_"))

const stripe = new Stripe(stripeSecretKey ?? "sk_test_placeholder")

const APPROVED_VENDOR_ID = "e2e-approved-vendor"
const APPROVED_VENDOR_USER_ID = "e2e-approved-user"
const ADMIN_USER_ID = "e2e-admin-user"

function buildSuffix(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function buildCurrencyAmountLabel(amount: number) {
  return Math.round(amount)
}

function expectedCapturedFees(amount: number) {
  const normalizedAmount = buildCurrencyAmountLabel(amount)

  return {
    stripeFeeAmount: Math.round(normalizedAmount * 0.015) + 25,
    platformFeeAmount: Math.round(normalizedAmount * 0.005),
    vendorNetAmount:
      normalizedAmount -
      (Math.round(normalizedAmount * 0.015) + 25) -
      Math.round(normalizedAmount * 0.005),
  }
}

async function createManualCaptureIntent(amount: number) {
  return stripe.paymentIntents.create({
    amount,
    currency: "eur",
    capture_method: "manual",
    payment_method: "pm_card_visa",
    payment_method_types: ["card"],
    confirm: true,
  })
}

async function createClientProfile(seed: string) {
  return prisma.clientProfile.create({
    data: {
      vendorId: APPROVED_VENDOR_ID,
      fullName: `Finance ${seed}`,
      firstName: "Finance",
      lastName: seed,
      email: `${seed}@contrazy.test`,
      phone: "+33123456789",
      address: "1 Audit Street",
      country: "France",
    },
  })
}

async function createDepositTransaction(seed: string, amount: number) {
  const clientProfile = await createClientProfile(seed)
  const intent = await createManualCaptureIntent(amount)
  const transactionId = buildSuffix(`txn-${seed}`)

  const transaction = await prisma.transaction.create({
    data: {
      id: transactionId,
      vendorId: APPROVED_VENDOR_ID,
      clientProfileId: clientProfile.id,
      reference: buildSuffix(`REF-${seed}`).toUpperCase(),
      title: `Finance ${seed}`,
      status: "PAYMENT_AUTHORIZED",
      currency: "EUR",
      depositAmount: amount,
      depositAuthorization: {
        create: {
          status: "AUTHORIZED",
          amount,
          currency: "EUR",
          stripeIntentId: intent.id,
          authorizedAt: new Date(),
        },
      },
    },
    include: {
      depositAuthorization: true,
      clientProfile: true,
    },
  })

  return { clientProfile, intent, transaction }
}

async function createDeferredServicePaymentTransaction(seed: string, amount: number) {
  const clientProfile = await createClientProfile(seed)
  const transactionId = buildSuffix(`txn-${seed}`)

  const transaction = await prisma.transaction.create({
    data: {
      id: transactionId,
      vendorId: APPROVED_VENDOR_ID,
      clientProfileId: clientProfile.id,
      reference: buildSuffix(`REF-${seed}`).toUpperCase(),
      title: `Deferred ${seed}`,
      status: "SIGNED",
      currency: "EUR",
      amount,
      paymentCollectionTiming: "AFTER_SERVICE",
      customerCompletedAt: new Date(),
      link: {
        create: {
          token: buildSuffix(`token-${seed}`),
        },
      },
    },
    include: {
      link: true,
      clientProfile: true,
    },
  })

  return { clientProfile, transaction }
}

async function createDisputeTransaction(seed: string, amount: number) {
  const { clientProfile, transaction } = await createDepositTransaction(seed, amount)

  const dispute = await prisma.dispute.create({
    data: {
      transactionId: transaction.id,
      status: "OPEN",
      summary: "Client disputed the vendor claim during e2e verification.",
    },
  })

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "DISPUTED" },
  })

  return { clientProfile, dispute, transaction }
}

async function deleteTransactionArtifacts(transactionId: string, clientProfileId: string) {
  await prisma.transaction.deleteMany({
    where: { id: transactionId },
  })

  await prisma.clientProfile.deleteMany({
    where: { id: clientProfileId },
  })
}

async function postJson(page: Parameters<typeof loginAs>[0], url: string, body?: unknown) {
  return page.evaluate(
    async ({ body: rawBody, url: targetUrl }) => {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody === undefined ? undefined : JSON.stringify(rawBody),
      })

      return {
        status: response.status,
        payload: await response.json(),
      }
    },
    { body, url }
  )
}

async function patchJson(page: Parameters<typeof loginAs>[0], url: string, body: unknown) {
  return page.evaluate(
    async ({ body: rawBody, url: targetUrl }) => {
      const response = await fetch(targetUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawBody),
      })

      return {
        status: response.status,
        payload: await response.json(),
      }
    },
    { body, url }
  )
}

test.afterAll(async () => {
  await prisma.$disconnect()
})

test.skip(!hasStripeSecretKey, "Finance e2e requires a Stripe secret key in .env.test.local.")

test("vendor full deposit capture records the fixed fee breakdown and audit trail", async ({ page }) => {
  const seed = buildSuffix("full-capture")
  const { clientProfile, transaction } = await createDepositTransaction(seed, 10_000)

  try {
    await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

    const response = await postJson(page, `/api/vendor/transactions/${transaction.id}/deposit`, {
      action: "capture",
    })

    expect(response.status).toBe(200)
    expect(response.payload.success).toBeTruthy()

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId_kind: {
          transactionId: transaction.id,
          kind: PaymentKind.DEPOSIT_CAPTURE,
        },
      },
    })

    const expectedFees = expectedCapturedFees(10_000)

    expect(payment).not.toBeNull()
    expect(payment?.amount).toBe(10_000)
    expect(payment?.stripeFeeAmount).toBe(expectedFees.stripeFeeAmount)
    expect(payment?.platformFeeAmount).toBe(expectedFees.platformFeeAmount)
    expect(payment?.vendorNetAmount).toBe(expectedFees.vendorNetAmount)

    const event = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "DEPOSIT_CAPTURED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(event?.metadata).toMatchObject({
      reason: "manual_capture",
      captureType: "full",
      processedAmount: 10_000,
      stripeFeeAmount: expectedFees.stripeFeeAmount,
      platformFeeAmount: expectedFees.platformFeeAmount,
      vendorNetAmount: expectedFees.vendorNetAmount,
    })

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "Captured deposit hold",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(auditLog?.actorId).toBe(APPROVED_VENDOR_USER_ID)
    expect(auditLog?.metadata).toMatchObject({
      captureType: "full",
      processedAmount: 10_000,
      platformFeeAmount: expectedFees.platformFeeAmount,
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})

test("vendor partial deposit capture records the fixed fee breakdown against the captured amount", async ({ page }) => {
  const seed = buildSuffix("partial-capture")
  const { clientProfile, transaction } = await createDepositTransaction(seed, 10_000)

  try {
    await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

    const response = await postJson(page, `/api/vendor/transactions/${transaction.id}/deposit`, {
      action: "capture",
      captureAmount: 8_000,
    })

    expect(response.status).toBe(200)
    expect(response.payload.success).toBeTruthy()

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId_kind: {
          transactionId: transaction.id,
          kind: PaymentKind.DEPOSIT_CAPTURE,
        },
      },
    })

    const expectedFees = expectedCapturedFees(8_000)

    expect(payment?.amount).toBe(8_000)
    expect(payment?.stripeFeeAmount).toBe(expectedFees.stripeFeeAmount)
    expect(payment?.platformFeeAmount).toBe(expectedFees.platformFeeAmount)
    expect(payment?.vendorNetAmount).toBe(expectedFees.vendorNetAmount)

    const event = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "DEPOSIT_CAPTURED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(event?.metadata).toMatchObject({
      reason: "manual_capture",
      captureType: "partial",
      authorizedAmount: 10_000,
      processedAmount: 8_000,
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})

test("vendor manual release records a release ledger row, event, and audit log", async ({ page }) => {
  const seed = buildSuffix("manual-release")
  const { clientProfile, transaction } = await createDepositTransaction(seed, 9_000)

  try {
    await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

    const response = await postJson(page, `/api/vendor/transactions/${transaction.id}/deposit`, {
      action: "release",
    })

    expect(response.status).toBe(200)
    expect(response.payload.success).toBeTruthy()

    const depositAuthorization = await prisma.depositAuthorization.findUnique({
      where: { transactionId: transaction.id },
    })
    expect(depositAuthorization?.status).toBe("RELEASED")

    const payment = await prisma.payment.findUnique({
      where: {
        transactionId_kind: {
          transactionId: transaction.id,
          kind: PaymentKind.DEPOSIT_RELEASE,
        },
      },
    })

    expect(payment?.amount).toBe(9_000)
    expect(payment?.status).toBe("RELEASED")

    const event = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "DEPOSIT_RELEASED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(event?.metadata).toMatchObject({
      reason: "manual_release",
      processedAmount: 9_000,
    })

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "Released deposit hold",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(auditLog?.actorId).toBe(APPROVED_VENDOR_USER_ID)
    expect(auditLog?.metadata).toMatchObject({
      releaseReason: "manual_release",
      processedAmount: 9_000,
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})

test("transaction cancel keeps deposit status CANCELLED but still writes release ledger and audit records", async ({ page }) => {
  const seed = buildSuffix("cancelled-release")
  const { clientProfile, transaction } = await createDepositTransaction(seed, 9_500)

  try {
    await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

    const response = await postJson(page, `/api/vendor/transactions/${transaction.id}/cancel`)

    expect(response.status).toBe(200)
    expect(response.payload.success).toBeTruthy()

    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: { depositAuthorization: true },
    })

    expect(updatedTransaction?.status).toBe("CANCELLED")
    expect(updatedTransaction?.depositAuthorization?.status).toBe("CANCELLED")

    const releasePayment = await prisma.payment.findUnique({
      where: {
        transactionId_kind: {
          transactionId: transaction.id,
          kind: PaymentKind.DEPOSIT_RELEASE,
        },
      },
    })

    expect(releasePayment?.amount).toBe(9_500)

    const releaseEvent = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "DEPOSIT_RELEASED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(releaseEvent?.metadata).toMatchObject({
      reason: "transaction_cancelled",
      processedAmount: 9_500,
    })

    const cancelledEvent = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "TRANSACTION_CANCELLED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(cancelledEvent?.metadata).toMatchObject({
      hadAuthorizedDeposit: true,
      depositReleaseReason: "transaction_cancelled",
    })

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "Cancelled transaction and released deposit hold",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(auditLog?.actorId).toBe(APPROVED_VENDOR_USER_ID)
    expect(auditLog?.metadata).toMatchObject({
      releaseReason: "transaction_cancelled",
      depositStatusAfterRelease: "CANCELLED",
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})

test("admin client-wins dispute resolution writes the release ledger and admin audit log", async ({ page }) => {
  const seed = buildSuffix("admin-dispute")
  const { clientProfile, dispute, transaction } = await createDisputeTransaction(seed, 11_000)

  try {
    await loginAs(page, e2eUsers.admin, E2E_PASSWORD)

    const response = await patchJson(page, `/api/admin/disputes/${dispute.id}`, {
      action: "resolve_client_wins",
      resolution: "Client evidence accepted.",
    })

    expect(response.status).toBe(200)
    expect(response.payload.success).toBeTruthy()

    const updatedDispute = await prisma.dispute.findUnique({
      where: { id: dispute.id },
    })
    expect(updatedDispute?.status).toBe("LOST")

    const depositAuthorization = await prisma.depositAuthorization.findUnique({
      where: { transactionId: transaction.id },
    })
    expect(depositAuthorization?.status).toBe("RELEASED")

    const releasePayment = await prisma.payment.findUnique({
      where: {
        transactionId_kind: {
          transactionId: transaction.id,
          kind: PaymentKind.DEPOSIT_RELEASE,
        },
      },
    })

    expect(releasePayment?.amount).toBe(11_000)

    const releaseEvent = await prisma.transactionEvent.findFirst({
      where: {
        transactionId: transaction.id,
        type: "DEPOSIT_RELEASED",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(releaseEvent?.metadata).toMatchObject({
      reason: "admin_dispute_release",
      processedAmount: 11_000,
    })

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: "Dispute",
        entityId: dispute.id,
        action: "Resolved dispute: client wins — deposit released",
      },
      orderBy: { createdAt: "desc" },
    })

    expect(auditLog?.actorId).toBe(ADMIN_USER_ID)
    expect(auditLog?.metadata).toMatchObject({
      releaseReason: "admin_dispute_release",
      amount: 11_000,
      resolution: "Client evidence accepted.",
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})

test("deferred service payment request writes one canonical event and a vendor audit log", async ({ page }) => {
  const seed = buildSuffix("after-service")
  const { clientProfile, transaction } = await createDeferredServicePaymentTransaction(seed, 19_999)

  try {
    await loginAs(page, e2eUsers.approvedVendor, E2E_PASSWORD)

    const firstResponse = await postJson(
      page,
      `/api/vendor/transactions/${transaction.id}/service-payment-request`
    )

    expect(firstResponse.status).toBe(200)
    expect(firstResponse.payload.success).toBeTruthy()

    const replayResponse = await postJson(
      page,
      `/api/vendor/transactions/${transaction.id}/service-payment-request`
    )

    expect(replayResponse.status).toBe(200)
    expect(replayResponse.payload.alreadyRequested).toBeTruthy()

    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      select: { servicePaymentRequestedAt: true },
    })

    expect(updatedTransaction?.servicePaymentRequestedAt).not.toBeNull()

    const events = await prisma.transactionEvent.findMany({
      where: {
        transactionId: transaction.id,
        type: "SERVICE_PAYMENT_REQUESTED",
      },
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.metadata).toMatchObject({
      amount: 19_999,
      currency: "EUR",
      paymentCollectionTiming: "AFTER_SERVICE",
    })

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "Requested deferred service payment",
      },
    })

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]?.actorId).toBe(APPROVED_VENDOR_USER_ID)
    expect(auditLogs[0]?.metadata).toMatchObject({
      amount: 19_999,
      currency: "EUR",
      paymentCollectionTiming: "AFTER_SERVICE",
    })
  } finally {
    await deleteTransactionArtifacts(transaction.id, clientProfile.id)
  }
})
