import "server-only"

import type { Prisma, VendorSubscription } from "@prisma/client"

type UsageField =
  | "transactionsUsed"
  | "eSignaturesUsed"
  | "kycVerificationsUsed"
  | "qrCodesUsed"
  | "smsWhatsappUsed"
  | "teamUsersUsed"

async function getVendorSubscription(tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient, vendorId: string) {
  return tx.vendorSubscription.findUnique({
    where: { vendorId },
  })
}

export async function incrementVendorSubscriptionUsage(
  tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  vendorId: string,
  field: UsageField,
  amount = 1
) {
  const subscription = await getVendorSubscription(tx, vendorId)

  if (!subscription) {
    return null
  }

  return tx.vendorSubscription.update({
    where: { vendorId },
    data: {
      [field]: {
        increment: amount,
      },
    },
  })
}

export async function ensureUsageWindow(
  tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  subscription: VendorSubscription,
  currentPeriodStart: Date | null,
  currentPeriodEnd: Date | null
) {
  const nextStart = currentPeriodStart ?? subscription.currentPeriodStart ?? subscription.usagePeriodStart
  const nextEnd = currentPeriodEnd ?? subscription.currentPeriodEnd ?? subscription.usagePeriodEnd

  const startChanged =
    nextStart?.getTime() !== subscription.usagePeriodStart?.getTime()
  const endChanged =
    nextEnd?.getTime() !== subscription.usagePeriodEnd?.getTime()

  if (!startChanged && !endChanged) {
    return subscription
  }

  return tx.vendorSubscription.update({
    where: { id: subscription.id },
    data: {
      usagePeriodStart: nextStart,
      usagePeriodEnd: nextEnd,
      transactionsUsed: 0,
      eSignaturesUsed: 0,
      kycVerificationsUsed: 0,
      qrCodesUsed: 0,
      smsWhatsappUsed: 0,
      teamUsersUsed: 0,
    },
  })
}
