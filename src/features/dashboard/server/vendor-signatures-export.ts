import { SignatureStatus, type Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { normalizeFilterOptionValue, vendorSignatureStatusOptions } from "@/features/dashboard/filter-options"
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

export type VendorSignaturesExportFilters = {
  q?: string
  status?: string
}

export type VendorSignaturesExportDateRange = {
  min: string | null
  max: string | null
}

export type VendorSignaturesCsvRow = {
  signatureDate: string
  signer: string
  reference: string
  status: string
  template: string
  signatureImageStored: string
}

type VendorSignaturesExportQuery = VendorSignaturesExportFilters & {
  startDate?: string
  endDate?: string
}

function buildVendorSignaturesWhere(
  vendorId: string,
  filters: VendorSignaturesExportQuery = {}
): Prisma.TransactionWhereInput {
  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorSignatureStatusOptions) as
    | SignatureStatus
    | undefined

  return {
    vendorId,
    signatureRecord: { isNot: null },
    ...(status ? { signatureRecord: { is: { status } } } : {}),
    ...(filters.startDate || filters.endDate
      ? {
          signatureRecord: {
            is: {
              ...(status ? { status } : {}),
              OR: [
                {
                  signedAt: {
                    ...(filters.startDate ? { gte: toStartOfDayUtc(filters.startDate) } : {}),
                    ...(filters.endDate ? { lte: toEndOfDayUtc(filters.endDate) } : {}),
                  },
                },
                {
                  AND: [
                    { signedAt: null },
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
          },
        }
      : {}),
    ...(search
      ? {
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
            { contractTemplate: { is: { name: containsInsensitive(search) } } },
            { signatureRecord: { is: { signerName: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }
}

function resolveSignatureRowDate(transaction: {
  signatureRecord: { signedAt: Date | null; createdAt: Date } | null
}) {
  return transaction.signatureRecord?.signedAt ?? transaction.signatureRecord?.createdAt ?? null
}

export async function getVendorSignaturesExportAvailableRange(
  vendorId: string,
  filters: VendorSignaturesExportFilters = {}
): Promise<VendorSignaturesExportDateRange> {
  const accumulator = createExportRangeAccumulator()
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where: buildVendorSignaturesWhere(vendorId, filters),
      select: {
        id: true,
        signatureRecord: { select: { signedAt: true, createdAt: true } },
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

    if (transactions.length === 0) {
      break
    }

    for (const transaction of transactions) {
      registerExportDate(accumulator, resolveSignatureRowDate(transaction))
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return finalizeExportRange(accumulator)
}

export async function getVendorSignaturesCsvRows(
  vendorId: string,
  filters: VendorSignaturesExportQuery
): Promise<VendorSignaturesCsvRow[]> {
  const rows: VendorSignaturesCsvRow[] = []
  let cursorId: string | undefined

  for (;;) {
    const transactions = await prisma.transaction.findMany({
      where: buildVendorSignaturesWhere(vendorId, filters),
      select: {
        id: true,
        reference: true,
        clientProfile: { select: { fullName: true } },
        contractTemplate: { select: { name: true } },
        signatureRecord: {
          select: {
            signerName: true,
            status: true,
            signedAt: true,
            createdAt: true,
          },
        },
        contractArtifact: {
          select: {
            signatureImagePublicId: true,
            signatureImageUrl: true,
          },
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

    if (transactions.length === 0) {
      break
    }

    for (const transaction of transactions) {
      rows.push({
        signatureDate: formatExportDateTime(resolveSignatureRowDate(transaction)),
        signer:
          transaction.signatureRecord?.signerName ??
          transaction.clientProfile?.fullName ??
          "Client",
        reference: transaction.reference,
        status: transaction.signatureRecord?.status ?? "PENDING",
        template: transaction.contractTemplate?.name ?? "Agreement",
        signatureImageStored:
          transaction.contractArtifact?.signatureImagePublicId ||
          transaction.contractArtifact?.signatureImageUrl
            ? "Yes"
            : "No",
      })
    }

    if (transactions.length < EXPORT_BATCH_SIZE) {
      break
    }

    cursorId = transactions.at(-1)?.id
  }

  return rows
}
