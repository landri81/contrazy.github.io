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
  const result = await tx.vendorSubscription.updateMany({
    where: { vendorId },
    data: {
      [field]: {
        increment: amount,
      },
    },
  })

  if (result.count === 0) {
    return null
  }

  return result
}

export async function incrementVendorSubscriptionUsageFields(
  tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  vendorId: string,
  increments: Partial<Record<UsageField, number>>
) {
  const data = Object.fromEntries(
    Object.entries(increments)
      .filter(([, amount]) => typeof amount === "number" && amount > 0)
      .map(([field, amount]) => [
        field,
        {
          increment: amount as number,
        },
      ])
  ) as Prisma.VendorSubscriptionUpdateInput

  if (Object.keys(data).length === 0) {
    return getVendorSubscription(tx, vendorId)
  }

  return tx.vendorSubscription.update({
    where: { vendorId },
    data,
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
