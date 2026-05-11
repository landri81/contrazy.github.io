import { z } from "zod"

import { requireVendorProfileAccess, ensureVendorSubscriptionEligible } from "@/lib/auth/guards"
import { formatCsv, type CsvColumn } from "@/lib/export/csv"
import {
  getVendorSignaturesCsvRows,
  getVendorSignaturesExportAvailableRange,
  type VendorSignaturesCsvRow,
} from "@/features/dashboard/server/vendor-signatures-export"
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

const csvColumns: CsvColumn<VendorSignaturesCsvRow>[] = [
  { header: "Signature Date", value: (row) => row.signatureDate },
  { header: "Signer", value: (row) => row.signer },
  { header: "Reference", value: (row) => row.reference },
  { header: "Status", value: (row) => row.status },
  { header: "Template", value: (row) => row.template },
  { header: "Signature Image Stored", value: (row) => row.signatureImageStored },
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

    const availableRange = await getVendorSignaturesExportAvailableRange(vendorProfile.id, {
      q,
      status,
    })

    if (!availableRange.min || !availableRange.max) {
      return jsonExportError("There are no exportable records for the current filters.", 404)
    }

    if (startDate < availableRange.min || endDate > availableRange.max) {
      return jsonExportError("Selected dates are outside the available data range.", 422)
    }

    const rows = await getVendorSignaturesCsvRows(vendorProfile.id, {
      q,
      status,
      startDate,
      endDate,
    })

    if (rows.length === 0) {
      return jsonExportError("No records found for the selected date range.", 404)
    }

    const csv = formatCsv(rows, csvColumns, { includeBom: true })
    return createCsvDownloadResponse(csv, "vendor-signatures")
  } catch (error) {
    console.error("Vendor signatures export failed", error)
    return jsonExportError("Failed to export vendor signatures.", 500)
  }
}
