import { z } from "zod"

import { requireVendorProfileAccess, ensureVendorSubscriptionEligible } from "@/lib/auth/guards"
import { formatCsv, type CsvColumn } from "@/lib/export/csv"
import {
  getVendorLinksCsvRows,
  getVendorLinksExportAvailableRange,
  type VendorLinksCsvRow,
} from "@/features/dashboard/server/vendor-links-export"
import {
  createCsvDownloadResponse,
  jsonExportError,
} from "@/features/dashboard/server/vendor-export-utils"

export const runtime = "nodejs"
export const maxDuration = 60

const exportRequestSchema = z.object({
  q: z.string().trim().optional(),
  state: z.string().trim().optional(),
  kind: z.string().trim().optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
})

const csvColumns: CsvColumn<VendorLinksCsvRow>[] = [
  { header: "Created At", value: (row) => row.createdAt },
  { header: "Reference", value: (row) => row.reference },
  { header: "Client Name", value: (row) => row.clientName },
  { header: "Client Email", value: (row) => row.clientEmail },
  { header: "Title", value: (row) => row.title },
  { header: "Type", value: (row) => row.kind },
  { header: "Service Amount", value: (row) => row.serviceAmount },
  { header: "Deposit Amount", value: (row) => row.depositAmount },
  { header: "Short Code", value: (row) => row.shortCode },
  { header: "Last Activity", value: (row) => row.lastActivity },
  { header: "Status", value: (row) => row.status },
  { header: "Share Link", value: (row) => row.shareLink },
  { header: "Notes", value: (row) => row.notes },
  { header: "Expires At", value: (row) => row.expiresAt },
  { header: "Cancelled At", value: (row) => row.cancelledAt },
  { header: "Cancel Reason", value: (row) => row.cancelReason },
  { header: "Cancelled By", value: (row) => row.cancelledBy },
  { header: "QR Ready", value: (row) => row.qrReady },
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

    const { q, state, kind, startDate, endDate } = payload.data

    if (startDate > endDate) {
      return jsonExportError("Start date cannot be after end date.", 422)
    }

    const availableRange = await getVendorLinksExportAvailableRange(vendorProfile.id, {
      q,
      state,
      kind,
    })

    if (!availableRange.min || !availableRange.max) {
      return jsonExportError("There are no exportable records for the current filters.", 404)
    }

    if (startDate < availableRange.min || endDate > availableRange.max) {
      return jsonExportError("Selected dates are outside the available data range.", 422)
    }

    const rows = await getVendorLinksCsvRows(vendorProfile.id, {
      q,
      state,
      kind,
      startDate,
      endDate,
    })

    if (rows.length === 0) {
      return jsonExportError("No records found for the selected date range.", 404)
    }

    const csv = formatCsv(rows, csvColumns, { includeBom: true })
    return createCsvDownloadResponse(csv, "vendor-links")
  } catch (error) {
    console.error("Vendor links export failed", error)
    return jsonExportError("Failed to export vendor links.", 500)
  }
}
