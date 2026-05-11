import { KycStatus, type Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { normalizeFilterOptionValue, vendorKycStatusOptions } from "@/features/dashboard/filter-options"
import {
  containsInsensitive,
  createExportRangeAccumulator,
  EXPORT_BATCH_SIZE,
  finalizeExportRange,
  formatExportDateTime,
  normalizeSearchTerm,
  registerExportDate,
  toEndOfDayUtc,
  toStartOfDayUtc,
} from "@/features/dashboard/server/vendor-export-utils"

export type VendorKycExportFilters = {
  q?: string
  status?: string
}

export type VendorKycExportDateRange = {
  min: string | null
  max: string | null
}

export type VendorKycCsvRow = {
  createdAt: string
  clientName: string
  reference: string
  status: string
  provider: string
  note: string
}

type VendorKycExportQuery = VendorKycExportFilters & {
  startDate?: string
  endDate?: string
}

function buildVendorKycWhere(
  vendorId: string,
  filters: VendorKycExportQuery = {}
): Prisma.TransactionWhereInput {
  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorKycStatusOptions) as
    | KycStatus
    | undefined

  return {
    vendorId,
    AND: [
      { OR: [{ requiresKyc: true }, { kycVerification: { isNot: null } }] },
      ...(status
        ? status === KycStatus.PENDING
          ? [{ OR: [{ kycVerification: { is: null } }, { kycVerification: { is: { status } } }] }]
          : [{ kycVerification: { is: { status } } }]
        : []),
      ...(filters.startDate || filters.endDate
        ? [
            {
              OR: [
                {
                  kycVerification: {
                    is: {
                      createdAt: {
                        ...(filters.startDate ? { gte: toStartOfDayUtc(filters.startDate) } : {}),
                        ...(filters.endDate ? { lte: toEndOfDayUtc(filters.endDate) } : {}),
                      },
                    },
                  },
                },
                {
                  AND: [
                    { kycVerification: { is: null } },
                    {
                      createdAt: {
                        ...(filters.startDate ? { gte: toStartOfDayUtc(filters.startDate) } : {}),
                        ...(filters.endDate ? { lte: toEndOfDayUtc(filters.endDate) } : {}),
                      },
                    },
                  ],
                },
              ],
            },
          ]
        : []),
      ...(search
        ? [
            {
              OR: [
                { reference: containsInsensitive(search) },
                {
                  clientProfile: {
                    is: {
                      OR: [
                        { fullName: containsInsensitive(search) },
                        { email: containsInsensitive(search) },
                      ],
                    },
                  },
                },
                { kycVerification: { is: { provider: containsInsensitive(search) } } },
                { kycVerification: { is: { summary: containsInsensitive(search) } } },
              ],
            },
          ]
        : []),
    ],
  }
}

function resolveKycRowDate(transaction: {
  createdAt: Date
  kycVerification: { createdAt: Date } | null
}) {
  return transaction.kycVerification?.createdAt ?? transaction.createdAt
}

export async function getVendorKycExportAvailableRange(
  vendorId: string,
  filters: VendorKycExportFilters = {}
): Promise<VendorKycExportDateRange> {
  const accumulator = createExportRangeAccumulator()
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where: buildVendorKycWhere(vendorId, filters),
      select: {
        id: true,
        createdAt: true,
        kycVerification: { select: { createdAt: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORT_BATCH_SIZE,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    })

    if (transactions.length === 0) {
      break
    }

    for (const transaction of transactions) {
      registerExportDate(accumulator, resolveKycRowDate(transaction))
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return finalizeExportRange(accumulator)
}

export async function getVendorKycCsvRows(
  vendorId: string,
  filters: VendorKycExportQuery
): Promise<VendorKycCsvRow[]> {
  const rows: VendorKycCsvRow[] = []
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where: buildVendorKycWhere(vendorId, filters),
      select: {
        id: true,
        createdAt: true,
        reference: true,
        clientProfile: { select: { fullName: true } },
        kycVerification: {
          select: {
            createdAt: true,
            status: true,
            provider: true,
            summary: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORT_BATCH_SIZE,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    })

    if (transactions.length === 0) {
      break
    }

    for (const transaction of transactions) {
      rows.push({
        createdAt: formatExportDateTime(resolveKycRowDate(transaction)),
        clientName: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        status: transaction.kycVerification?.status ?? "PENDING",
        provider: transaction.kycVerification?.provider ?? "Stripe Identity",
        note:
          transaction.kycVerification?.summary ??
          "Verification linked to the live transaction flow.",
      })
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return rows
}
