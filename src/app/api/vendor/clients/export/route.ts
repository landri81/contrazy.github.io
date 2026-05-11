import { z } from "zod"

import { requireVendorProfileAccess, ensureVendorSubscriptionEligible } from "@/lib/auth/guards"
import { formatCsv, type CsvColumn } from "@/lib/export/csv"
import {
  getVendorClientsCsvRows,
  getVendorClientsExportAvailableRange,
  type VendorClientsCsvRow,
} from "@/features/dashboard/server/vendor-clients-export"
import {
  createCsvDownloadResponse,
  jsonExportError,
} from "@/features/dashboard/server/vendor-export-utils"

export const runtime = "nodejs"
export const maxDuration = 60

const exportRequestSchema = z.object({
  q: z.string().trim().optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
})

const csvColumns: CsvColumn<VendorClientsCsvRow>[] = [
  { header: "Created At", value: (row) => row.createdAt },
  { header: "Client Name", value: (row) => row.clientName },
  { header: "Client Email", value: (row) => row.clientEmail },
  { header: "Company Name", value: (row) => row.companyName },
  { header: "Status", value: (row) => row.status },
  { header: "Recent Transaction", value: (row) => row.recentTransaction },
]

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const payload = exportRequestSchema.safeParse(await request.json())

    if (!payload.success) {
      return jsonExportError("Invalid export request.", 400)
    }

    const { q, startDate, endDate } = payload.data

    if (startDate > endDate) {
      return jsonExportError("Start date cannot be after end date.", 422)
    }

    const availableRange = await getVendorClientsExportAvailableRange(vendorProfile.id, { q })

    if (!availableRange.min || !availableRange.max) {
      return jsonExportError("There are no exportable records for the current filters.", 404)
    }

    if (startDate < availableRange.min || endDate > availableRange.max) {
      return jsonExportError("Selected dates are outside the available data range.", 422)
    }

    const rows = await getVendorClientsCsvRows(vendorProfile.id, {
      q,
      startDate,
      endDate,
    })

    if (rows.length === 0) {
      return jsonExportError("No records found for the selected date range.", 404)
    }

    const csv = formatCsv(rows, csvColumns, { includeBom: true })
    return createCsvDownloadResponse(csv, "vendor-clients")
  } catch (error) {
    console.error("Vendor clients export failed", error)
    return jsonExportError("Failed to export vendor clients.", 500)
  }
}
