"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarDays, ChevronDown, Download, LoaderCircle } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/toast"

type VendorTableExportDialogProps = {
  endpoint: string
  filenamePrefix: string
  requestPayload?: Record<string, string | undefined>
  availableRange: {
    min: string | null
    max: string | null
  }
  title: string
  description: string
}

function getFilenameFromDisposition(value: string | null) {
  if (!value) return null
  const match = value.match(/filename="([^"]+)"/i)
  return match?.[1] ?? null
}

function parseDateValue(value: string | null | undefined) {
  return value ? parseISO(value) : undefined
}

function toDateValue(value: Date | undefined) {
  return value ? format(value, "yyyy-MM-dd") : ""
}

function DatePickerField({
  label,
  placeholder,
  value,
  minDate,
  maxDate,
  formatter,
  disabled,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  minDate?: Date
  maxDate?: Date
  formatter: Intl.DateTimeFormat
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedDate = useMemo(() => parseDateValue(value), [value])

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm shadow-sm transition hover:border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="truncate text-foreground">
              {selectedDate ? formatter.format(selectedDate) : placeholder}
            </span>
          </span>

          <ChevronDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent className="w-auto rounded-xl border bg-white p-0 shadow-lg">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate ?? minDate}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return
              onChange(toDateValue(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function VendorTableExportDialog({
  endpoint,
  filenamePrefix,
  requestPayload,
  availableRange,
  title,
  description,
}: VendorTableExportDialogProps) {
  const t = useTranslations("dashboard.shared.exportDialog")
  const locale = useLocale()

  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(availableRange.min ?? "")
  const [endDate, setEndDate] = useState(availableRange.max ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const hasRange = Boolean(availableRange.min && availableRange.max)

  const minDate = useMemo(() => parseDateValue(availableRange.min), [availableRange.min])
  const maxDate = useMemo(() => parseDateValue(availableRange.max), [availableRange.max])
  const startDateObj = useMemo(() => parseDateValue(startDate), [startDate])
  const endDateObj = useMemo(() => parseDateValue(endDate), [endDate])

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale]
  )

  const rangeLabel = useMemo(() => {
    if (!availableRange.min || !availableRange.max) return null
    return t("availableRangeValue", {
      start: formatter.format(new Date(availableRange.min)),
      end: formatter.format(new Date(availableRange.max)),
    })
  }, [availableRange.max, availableRange.min, formatter, t])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isExporting) {
      return
    }

    if (nextOpen) {
      setStartDate(availableRange.min ?? "")
      setEndDate(availableRange.max ?? "")
    }

    setError(null)
    setOpen(nextOpen)
  }

  function validate() {
    if (!hasRange) return t("errors.noData")
    if (!startDate) return t("errors.startRequired")
    if (!endDate) return t("errors.endRequired")
    if (startDate > endDate) return t("errors.invalidRange")
    if (availableRange.min && startDate < availableRange.min) return t("errors.beforeAvailable")
    if (availableRange.max && endDate > availableRange.max) return t("errors.afterAvailable")
    return null
  }

  async function handleExport() {
    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestPayload,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : t("errors.unexpected")

        setError(message)
        toast({
          variant: "error",
          title: t("toast.errorTitle"),
          description: message,
        })
        return
      }

      const blob = await response.blob()
      const filename =
        getFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
        `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)

      toast({
        variant: "success",
        title: t("toast.successTitle"),
        description: t("toast.successDescription"),
      })

      setOpen(false)
    } catch {
      const message = t("errors.unexpected")
      setError(message)
      toast({
        variant: "error",
        title: t("toast.errorTitle"),
        description: message,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        disabled={!hasRange || isExporting}
        className="gap-2"
      >
        <Download className="size-4" />
        {t("trigger")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[480px] overflow-hidden rounded-2xl bg-background p-0">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-lg font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3.5">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {t("availableRangeLabel")}
              </p>
              <p className="mt-1.5 text-[15px] font-medium text-foreground">
                {rangeLabel ?? t("noDataAvailable")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DatePickerField
                label={t("startDate")}
                placeholder={t("startDate")}
                value={startDate}
                minDate={minDate}
                maxDate={endDateObj ?? maxDate}
                formatter={formatter}
                disabled={!hasRange || isExporting}
                onChange={(value) => {
                  setStartDate(value)
                  setError(null)
                }}
              />
              <DatePickerField
                label={t("endDate")}
                placeholder={t("endDate")}
                value={endDate}
                minDate={startDateObj ?? minDate}
                maxDate={maxDate}
                formatter={formatter}
                disabled={!hasRange || isExporting}
                onChange={(value) => {
                  setEndDate(value)
                  setError(null)
                }}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-5 py-3 mb-2 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isExporting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={!hasRange || isExporting}
              className="gap-2 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
            >
              {isExporting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("exporting")}
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  {t("submit")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
