import { type Prisma, type TransactionKind, type TransactionStatus } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import {
  normalizeFilterOptionValue,
  vendorTransactionKindOptions,
  vendorTransactionStatusOptions,
} from "@/features/dashboard/filter-options"
import {
  containsInsensitive,
  EXPORT_BATCH_SIZE,
  formatDisplayLabel,
  formatExportDateTime,
  formatMoney,
  normalizeSearchTerm,
  toDateInputValue,
  toEndOfDayUtc,
  toStartOfDayUtc,
} from "@/features/dashboard/server/vendor-export-utils"

export type VendorTransactionsExportFilters = {
  q?: string
  status?: string
  kind?: string
}

export type VendorTransactionsExportDateRange = {
  min: string | null
  max: string | null
}

export type VendorTransactionsCsvRow = {
  createdAt: string
  clientName: string
  clientEmail: string
  reference: string
  type: string
  amount: string
  kyc: string
  contract: string
  status: string
}

type VendorTransactionsExportQuery = VendorTransactionsExportFilters & {
  startDate?: string
  endDate?: string
}

function buildVendorTransactionsWhere(
  vendorId: string,
  filters: VendorTransactionsExportQuery = {}
): Prisma.TransactionWhereInput {
  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorTransactionStatusOptions) as
    | TransactionStatus
    | undefined
  const kind = normalizeFilterOptionValue(filters.kind, vendorTransactionKindOptions) as
    | TransactionKind
    | undefined

  return {
    vendorId,
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(filters.startDate || filters.endDate
      ? {
          createdAt: {
            ...(filters.startDate ? { gte: toStartOfDayUtc(filters.startDate) } : {}),
            ...(filters.endDate ? { lte: toEndOfDayUtc(filters.endDate) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            { title: containsInsensitive(search) },
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
            {
              bulkRecipient: {
                is: {
                  OR: [
                    { email: containsInsensitive(search) },
                    { normalizedEmail: containsInsensitive(search.toLowerCase()) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }
}

function mapTransactionKycValue(transaction: {
  requiresKyc: boolean
  kycVerification: { status: string } | null
}) {
  return transaction.requiresKyc ? transaction.kycVerification?.status ?? "Required" : "Not required"
}

function mapTransactionContractValue(transaction: {
  contractTemplateId: string | null
  signatureRecord: { status: string } | null
}) {
  return transaction.contractTemplateId != null
    ? transaction.signatureRecord?.status === "SIGNED"
      ? "Signed"
      : "Attached"
    : "Not required"
}

export async function getVendorTransactionsExportAvailableRange(
  vendorId: string,
  filters: VendorTransactionsExportFilters = {}
): Promise<VendorTransactionsExportDateRange> {
  const result = await prisma.transaction.aggregate({
    where: buildVendorTransactionsWhere(vendorId, filters),
    _min: { createdAt: true },
    _max: { createdAt: true },
  })

  return {
    min: toDateInputValue(result._min.createdAt),
    max: toDateInputValue(result._max.createdAt),
  }
}

export async function getVendorTransactionsCsvRows(
  vendorId: string,
  filters: VendorTransactionsExportQuery
): Promise<VendorTransactionsCsvRow[]> {
  const where = buildVendorTransactionsWhere(vendorId, filters)
  const rows: VendorTransactionsCsvRow[] = []
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        clientProfile: { select: { fullName: true, email: true } },
        bulkRecipient: { select: { email: true } },
        kycVerification: { select: { status: true } },
        signatureRecord: { select: { status: true } },
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
        createdAt: formatExportDateTime(transaction.createdAt),
        clientName: transaction.clientProfile?.fullName ?? "Client pending",
        clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? "No email",
        reference: transaction.reference,
        type: formatDisplayLabel(transaction.kind),
        amount: formatMoney(
          transaction.amount != null && transaction.amount > 0
            ? transaction.amount
            : transaction.depositAmount,
          transaction.currency
        ),
        kyc: mapTransactionKycValue(transaction),
        contract: mapTransactionContractValue(transaction),
        status: transaction.status,
      })
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return rows
}
