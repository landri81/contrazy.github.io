import { Prisma } from "@prisma/client"

export const EXPORT_BATCH_SIZE = 500

export type VendorExportAvailableRange = {
  min: string | null
  max: string | null
}

export type VendorExportRangeAccumulator = {
  min: Date | null
  max: Date | null
}

export function normalizeSearchTerm(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: Prisma.QueryMode.insensitive,
  }
}

export function toDateInputValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

export function toStartOfDayUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

export function toEndOfDayUtc(value: string) {
  return new Date(`${value}T23:59:59.999Z`)
}

export function formatExportDateTime(value: Date | null | undefined) {
  if (!value) {
    return ""
  }

  return value.toLocaleString("en-US")
}

export function formatDisplayLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatMoney(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) {
    return "Not set"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function createExportRangeAccumulator(): VendorExportRangeAccumulator {
  return {
    min: null,
    max: null,
  }
}

export function registerExportDate(
  accumulator: VendorExportRangeAccumulator,
  value: Date | null | undefined
) {
  if (!value) {
    return
  }

  if (!accumulator.min || value < accumulator.min) {
    accumulator.min = value
  }

  if (!accumulator.max || value > accumulator.max) {
    accumulator.max = value
  }
}

export function finalizeExportRange(
  accumulator: VendorExportRangeAccumulator
): VendorExportAvailableRange {
  return {
    min: toDateInputValue(accumulator.min),
    max: toDateInputValue(accumulator.max),
  }
}

export function jsonExportError(message: string, status: number) {
  return Response.json({ success: false, message }, { status })
}

export function createCsvDownloadResponse(csv: string, filenamePrefix: string) {
  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
