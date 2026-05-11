import { z } from "zod"

import { requireVendorProfileAccess, ensureVendorSubscriptionEligible } from "@/lib/auth/guards"
import { formatCsv, type CsvColumn } from "@/lib/export/csv"
import {
  getVendorKycCsvRows,
  getVendorKycExportAvailableRange,
  type VendorKycCsvRow,
} from "@/features/dashboard/server/vendor-kyc-export"
import {
  createCsvDownloadResponse,
  jsonExportError,
} from "@/features/dashboard/server/vendor-export-utils"

export const runtime = "nodejs"
export const maxDuration = 60

const exportRequestSchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().trim().optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
})

const csvColumns: CsvColumn<VendorKycCsvRow>[] = [
  { header: "Created At", value: (row) => row.createdAt },
  { header: "Client Name", value: (row) => row.clientName },
  { header: "Reference", value: (row) => row.reference },
  { header: "Status", value: (row) => row.status },
  { header: "Provider", value: (row) => row.provider },
  { header: "Note", value: (row) => row.note },
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

    const { q, status, startDate, endDate } = payload.data

    if (startDate > endDate) {
      return jsonExportError("Start date cannot be after end date.", 422)
    }

    const availableRange = await getVendorKycExportAvailableRange(vendorProfile.id, {
      q,
      status,
    })

    if (!availableRange.min || !availableRange.max) {
      return jsonExportError("There are no exportable records for the current filters.", 404)
    }

    if (startDate < availableRange.min || endDate > availableRange.max) {
      return jsonExportError("Selected dates are outside the available data range.", 422)
    }

    const rows = await getVendorKycCsvRows(vendorProfile.id, {
      q,
      status,
      startDate,
      endDate,
    })

    if (rows.length === 0) {
      return jsonExportError("No records found for the selected date range.", 404)
    }

    const csv = formatCsv(rows, csvColumns, { includeBom: true })
    return createCsvDownloadResponse(csv, "vendor-kyc")
  } catch (error) {
    console.error("Vendor KYC export failed", error)
    return jsonExportError("Failed to export vendor KYC records.", 500)
  }
}
