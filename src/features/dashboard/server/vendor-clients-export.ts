import { type Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import {
  containsInsensitive,
  EXPORT_BATCH_SIZE,
  formatExportDateTime,
  normalizeSearchTerm,
  toDateInputValue,
  toEndOfDayUtc,
  toStartOfDayUtc,
} from "@/features/dashboard/server/vendor-export-utils"

export type VendorClientsExportFilters = {
  q?: string
}

export type VendorClientsExportDateRange = {
  min: string | null
  max: string | null
}

export type VendorClientsCsvRow = {
  createdAt: string
  clientName: string
  clientEmail: string
  companyName: string
  status: string
  recentTransaction: string
}

type VendorClientsExportQuery = VendorClientsExportFilters & {
  startDate?: string
  endDate?: string
}

function buildVendorClientsWhere(
  vendorId: string,
  filters: VendorClientsExportQuery = {}
): Prisma.ClientProfileWhereInput {
  const search = normalizeSearchTerm(filters.q)

  return {
    vendorId,
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
            { fullName: containsInsensitive(search) },
            { email: containsInsensitive(search) },
            { companyName: containsInsensitive(search) },
          ],
        }
      : {}),
  }
}

export async function getVendorClientsExportAvailableRange(
  vendorId: string,
  filters: VendorClientsExportFilters = {}
): Promise<VendorClientsExportDateRange> {
  const result = await prisma.clientProfile.aggregate({
    where: buildVendorClientsWhere(vendorId, filters),
    _min: { createdAt: true },
    _max: { createdAt: true },
  })

  return {
    min: toDateInputValue(result._min.createdAt),
    max: toDateInputValue(result._max.createdAt),
  }
}

export async function getVendorClientsCsvRows(
  vendorId: string,
  filters: VendorClientsExportQuery
): Promise<VendorClientsCsvRow[]> {
  const where = buildVendorClientsWhere(vendorId, filters)
  const rows: VendorClientsCsvRow[] = []
  let cursorId: string | undefined

  for (;;) {
    const clients = await prisma.clientProfile.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        email: true,
        companyName: true,
        transactions: {
          select: { reference: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: EXPORT_BATCH_SIZE,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    })

    if (clients.length === 0) {
      break
    }

    for (const client of clients) {
      rows.push({
        createdAt: formatExportDateTime(client.createdAt),
        clientName: client.fullName,
        clientEmail: client.email,
        companyName: client.companyName ?? "",
        status: "Tracked",
        recentTransaction: client.transactions[0]?.reference ?? "Recent",
      })
    }

    if (clients.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = clients.at(-1)?.id
  }

  return rows
}
