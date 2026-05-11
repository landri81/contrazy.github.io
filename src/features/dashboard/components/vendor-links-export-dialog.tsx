"use client"

import { useTranslations } from "next-intl"

import { VendorTableExportDialog } from "@/features/dashboard/components/vendor-table-export-dialog"

type VendorLinksExportDialogProps = {
  searchParams?: Record<string, string>
  availableRange: {
    min: string | null
    max: string | null
  }
}

export function VendorLinksExportDialog({
  searchParams,
  availableRange,
}: VendorLinksExportDialogProps) {
  const t = useTranslations("dashboard.vendor.links")

  return (
    <VendorTableExportDialog
      endpoint="/api/vendor/links/export"
      filenamePrefix="vendor-links"
      requestPayload={searchParams}
      availableRange={availableRange}
      title={t("exportDialog.title")}
      description={t("exportDialog.description")}
    />
  )
}
