import { Prisma, type TransactionKind, type TransactionLinkStatus } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import {
  buildVendorLinkRecord,
  type VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import {
  containsInsensitive,
  EXPORT_BATCH_SIZE,
  formatDisplayLabel,
  formatExportDateTime,
  normalizeSearchTerm,
  toDateInputValue,
  toEndOfDayUtc,
  toStartOfDayUtc,
} from "@/features/dashboard/server/vendor-export-utils"
import {
  normalizeFilterOptionValue,
  vendorLinkStateOptions,
  vendorTransactionKindOptions,
} from "@/features/dashboard/filter-options"

export type VendorLinksExportFilters = {
  q?: string
  state?: string
  kind?: string
}

export type VendorLinksExportDateRange = {
  min: string | null
  max: string | null
}

export type VendorLinksCsvRow = {
  createdAt: string
  reference: string
  clientName: string
  clientEmail: string
  title: string
  kind: string
  serviceAmount: string
  depositAmount: string
  shortCode: string
  lastActivity: string
  status: string
  shareLink: string
  notes: string
  expiresAt: string
  cancelledAt: string
  cancelReason: string
  cancelledBy: string
  qrReady: string
}

type VendorLinksExportQuery = VendorLinksExportFilters & {
  startDate?: string
  endDate?: string
}

function buildVendorLinksWhere(
  vendorId: string,
  filters: VendorLinksExportQuery = {}
): Prisma.TransactionWhereInput {
  const search = normalizeSearchTerm(filters.q)
  const state = normalizeFilterOptionValue(filters.state, vendorLinkStateOptions) as
    | TransactionLinkStatus
    | undefined
  const kind = normalizeFilterOptionValue(filters.kind, vendorTransactionKindOptions) as
    | TransactionKind
    | undefined
  const linkFilter: Prisma.TransactionLinkNullableScalarRelationFilter = state
    ? { is: { status: state } }
    : { isNot: null }

  return {
    vendorId,
    link: linkFilter,
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
            { link: { is: { shortCode: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }
}

function mapVendorLinksCsvRow(
  createdAt: Date,
  record: VendorLinkRecord
): VendorLinksCsvRow {
  return {
    createdAt: formatExportDateTime(createdAt),
    reference: record.reference,
    clientName: record.clientName,
    clientEmail: record.clientEmail,
    title: record.title,
    kind: formatDisplayLabel(record.kind),
    serviceAmount: record.serviceAmount,
    depositAmount: record.depositAmount,
    shortCode: record.shortCode,
    lastActivity: record.lastActivity,
    status: record.status,
    shareLink: record.shareLink,
    notes: record.notes,
    expiresAt: record.expiresAtLabel,
    cancelledAt: record.cancelledAtLabel ?? "",
    cancelReason: record.cancelReason ?? "",
    cancelledBy: record.cancelledBy ?? "",
    qrReady: record.qrReady ? "Yes" : "No",
  }
}

export async function getVendorLinksExportAvailableRange(
  vendorId: string,
  filters: VendorLinksExportFilters = {}
): Promise<VendorLinksExportDateRange> {
  const result = await prisma.transaction.aggregate({
    where: buildVendorLinksWhere(vendorId, filters),
    _min: { createdAt: true },
    _max: { createdAt: true },
  })

  return {
    min: toDateInputValue(result._min.createdAt),
    max: toDateInputValue(result._max.createdAt),
  }
}

export async function getVendorLinksCsvRows(
  vendorId: string,
  filters: VendorLinksExportQuery
): Promise<VendorLinksCsvRow[]> {
  const where = buildVendorLinksWhere(vendorId, filters)
  const rows: VendorLinksCsvRow[] = []
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        clientProfile: { select: { fullName: true, email: true } },
        link: {
          select: {
            id: true,
            token: true,
            shortCode: true,
            status: true,
            createdAt: true,
            openedAt: true,
            completedAt: true,
            expiresAt: true,
            cancelledAt: true,
            cancelReason: true,
            cancelledBy: true,
            qrCodeSvg: true,
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
      const record = buildVendorLinkRecord({
        id: transaction.id,
        reference: transaction.reference,
        title: transaction.title,
        kind: transaction.kind,
        amount: transaction.amount,
        depositAmount: transaction.depositAmount,
        currency: transaction.currency,
        notes: transaction.notes,
        updatedAt: transaction.updatedAt,
        locale: transaction.locale,
        clientProfile: transaction.clientProfile,
        link: transaction.link,
      })

      rows.push(mapVendorLinksCsvRow(transaction.createdAt, record))
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return rows
}
