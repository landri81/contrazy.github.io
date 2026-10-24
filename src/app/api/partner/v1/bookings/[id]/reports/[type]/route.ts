import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { PartnerApiError, withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

const REPORT_TYPES = { "check-in": "CHECK_IN", "check-out": "CHECK_OUT" } as const

/**
 * The submitted check-in or check-out report as a standalone HTML document
 * (scope `bookings:read`); the `reportUrl` of `booking.check_*_submitted`
 * webhooks points here. 404 until the customer has submitted it.
 */
export const GET = withPartnerApi<{ id: string; type: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const { id, type } = await params
  const reportType = REPORT_TYPES[type as keyof typeof REPORT_TYPES]

  if (!reportType) {
    throw new PartnerApiError("not_found", "Report type must be check-in or check-out.")
  }

  const booking = await requirePartnerBooking(vendorProfile.id, { id })
  const report = booking.reports.find((item) => item.type === reportType && item.status !== "PENDING")

  if (!report?.artifactHtml) {
    throw new PartnerApiError("not_found", "This report has not been submitted yet.")
  }

  return new Response(report.artifactHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  })
})
