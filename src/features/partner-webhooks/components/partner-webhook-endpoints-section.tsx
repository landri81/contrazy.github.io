"use client"

import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, Inbox, Loader2, RefreshCw, RotateCcw, Send, ShieldAlert, Terminal, Webhook } from "lucide-react"
import { useRef, useState } from "react"
import type { PartnerWebhookDeliveryStatus } from "@prisma/client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import type {
  VendorPartnerWebhookDeliveryItem,
  VendorPartnerWebhookEndpointItem,
  VendorPartnerWebhooksData,
} from "@/features/partner-webhooks/server/vendor-webhooks"
import { cn } from "@/lib/utils"

const VISIBLE_EVENT_TYPES = 3

type ApiResponse = { success?: boolean; message?: string; code?: string }

type ResendResponse = ApiResponse & {
  outcome?: "succeeded" | "retried" | "dead" | "failed"
  delivery?: Pick<
    VendorPartnerWebhookDeliveryItem,
    "id" | "status" | "attempt" | "responseStatus" | "error" | "nextAttemptAt" | "lastAttemptAt" | "deliveredAt"
  >
}

const STATUS_BADGE_CLASSES: Record<PartnerWebhookDeliveryStatus, string> = {
  PENDING: "border-border bg-muted text-muted-foreground",
  SUCCEEDED: "border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]",
  FAILED: "border-amber-200 bg-amber-50 text-amber-800",
  DEAD: "border-red-200 bg-red-50 text-red-700",
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  // Fixed time zone so server and client render the same text.
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

function SectionRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-24 rounded-full md:block" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Inbox; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export function PartnerWebhookEndpointsSection({
  initialData,
  canManage,
}: {
  initialData: VendorPartnerWebhooksData | null
  canManage: boolean
}) {
  const t = useTranslations("dashboard.vendor.webhooks.partner")
  const locale = useLocale()
  const requestSequenceRef = useRef(0)

  const [data, setData] = useState<VendorPartnerWebhooksData | null>(initialData)
  const [loadFailed, setLoadFailed] = useState(canManage && initialData === null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const endpoints = data?.endpoints ?? []
  const deliveries = data?.deliveries.items ?? []

  async function loadPage(page: number) {
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    setIsLoading(true)

    try {
      const response = await fetch(`/api/vendor/partner-webhooks?page=${page}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as (VendorPartnerWebhooksData & ApiResponse) | null

      if (!response.ok || !payload?.endpoints || !payload.deliveries) {
        throw new Error(payload?.message ?? t("errorDescription"))
      }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      setData({ endpoints: payload.endpoints, deliveries: payload.deliveries })
      setLoadFailed(false)
    } catch (error) {
      if (requestId !== requestSequenceRef.current) {
        return
      }

      setLoadFailed(true)
      toast({
        variant: "error",
        title: t("errorTitle"),
        description: error instanceof Error ? error.message : t("errorDescription"),
      })
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsLoading(false)
      }
    }
  }

  function describeResponse(item: Pick<VendorPartnerWebhookDeliveryItem, "responseStatus" | "attempt">) {
    if (item.responseStatus !== null) {
      return t("httpStatus", { status: item.responseStatus })
    }

    return item.attempt > 0 ? t("noResponse") : null
  }

  async function resend(item: VendorPartnerWebhookDeliveryItem) {
    if (resendingId) {
      return
    }

    setResendingId(item.id)

    try {
      const response = await fetch(`/api/vendor/partner-webhooks/deliveries/${encodeURIComponent(item.id)}/resend`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as ResendResponse | null

      if (response.status === 409 && payload?.code === "ENDPOINT_REMOVED") {
        toast({ variant: "error", title: t("resendFailedTitle"), description: t("resendRemoved") })
        return
      }

      if (!response.ok || !payload?.delivery) {
        throw new Error(payload?.message ?? t("resendError"))
      }

      const updated = payload.delivery
      setData((current) =>
        current
          ? {
              ...current,
              deliveries: {
                ...current.deliveries,
                items: current.deliveries.items.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
              },
            }
          : current
      )

      if (payload.outcome === "succeeded") {
        toast({
          variant: "success",
          title: t("resendSucceededTitle"),
          description: t("resendSucceededDesc", { eventType: item.eventType }),
        })
      } else {
        toast({
          variant: "error",
          title: t("resendFailedTitle"),
          description: t("resendFailedDesc", {
            eventType: item.eventType,
            reason: describeResponse(updated) ?? t("noResponse"),
          }),
        })
      }
    } catch (error) {
      toast({
        variant: "error",
        title: t("resendFailedTitle"),
        description: error instanceof Error ? error.message : t("resendError"),
      })
    } finally {
      setResendingId(null)
    }
  }

  function renderStatusBadge(status: PartnerWebhookDeliveryStatus) {
    return (
      <Badge variant="outline" className={cn("rounded-full", STATUS_BADGE_CLASSES[status])}>
        {t(`status.${status}`)}
      </Badge>
    )
  }

  function renderEndpointBadge(endpoint: VendorPartnerWebhookEndpointItem) {
    return endpoint.active ? (
      <Badge variant="outline" className={cn("rounded-full", STATUS_BADGE_CLASSES.SUCCEEDED)}>
        {t("statusActive")}
      </Badge>
    ) : (
      <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
        {t("statusDisabled")}
      </Badge>
    )
  }

  function renderDeliveryTiming(item: VendorPartnerWebhookDeliveryItem) {
    if (item.status === "SUCCEEDED" && item.deliveredAt) {
      return t("deliveredAt", { date: formatDateTime(item.deliveredAt, locale) ?? "" })
    }

    if (item.status === "FAILED" && item.nextAttemptAt) {
      return t("nextRetry", { date: formatDateTime(item.nextAttemptAt, locale) ?? "" })
    }

    return t("createdAt", { date: formatDateTime(item.createdAt, locale) ?? "" })
  }

  function renderResendButton(item: VendorPartnerWebhookDeliveryItem, className?: string) {
    if (item.endpointRemoved) {
      return <span className="text-xs text-muted-foreground">{t("endpointRemoved")}</span>
    }

    const pending = resendingId === item.id

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("active:scale-[0.98]", className)}
        disabled={Boolean(resendingId)}
        aria-busy={pending}
        onClick={() => void resend(item)}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        {pending ? t("resending") : t("resend")}
      </Button>
    )
  }

  function renderBooking(item: VendorPartnerWebhookDeliveryItem) {
    if (!item.bookingReference && !item.externalRef) {
      return <span className="text-muted-foreground">-</span>
    }

    return (
      <div className="min-w-0">
        {item.bookingReference ? <p className="truncate font-medium text-foreground">{item.bookingReference}</p> : null}
        {item.externalRef ? <p className="truncate font-mono text-xs text-muted-foreground">{item.externalRef}</p> : null}
      </div>
    )
  }

  function renderEndpoints() {
    if (endpoints.length === 0) {
      return <EmptyState icon={Webhook} title={t("emptyEndpointsTitle")} description={t("emptyEndpointsDescription")} />
    }

    return (
      <ul className="divide-y divide-border/70">
        {endpoints.map((endpoint) => {
          const visible = endpoint.eventTypes.slice(0, VISIBLE_EVENT_TYPES)
          const hidden = endpoint.eventTypes.length - visible.length

          return (
            <li key={endpoint.id} className={cn("space-y-3 px-4 py-4 sm:px-5", !endpoint.active && "opacity-70")}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="break-all font-mono text-sm font-medium text-foreground">{endpoint.url}</p>
                  {endpoint.description ? (
                    <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {renderEndpointBadge(endpoint)}
                  <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30">
                    {t("eventsCount", { count: endpoint.eventTypes.length })}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5" title={endpoint.eventTypes.join(", ")}>
                {visible.map((type) => (
                  <Badge key={type} variant="outline" className="rounded-md border-border/80 bg-white font-mono text-[11px]">
                    {type}
                  </Badge>
                ))}
                {hidden > 0 ? (
                  <Badge variant="outline" className="rounded-md border-border/80 bg-muted/30 text-[11px]">
                    {t("moreEvents", { count: hidden })}
                  </Badge>
                ) : null}
              </div>

              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{t("secret")}</dt>
                  <dd className="mt-0.5 truncate font-mono text-foreground">{endpoint.secretPrefix}…</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("created")}</dt>
                  <dd className="mt-0.5 text-foreground">{formatDateTime(endpoint.createdAt, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("lastDelivery")}</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-foreground">
                    {endpoint.lastDelivery ? (
                      <>
                        {renderStatusBadge(endpoint.lastDelivery.status)}
                        <span>{formatDateTime(endpoint.lastDelivery.at, locale)}</span>
                      </>
                    ) : (
                      t("noDeliveryYet")
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderDeliveries() {
    if (!data) {
      return null
    }

    if (deliveries.length === 0) {
      return <EmptyState icon={Inbox} title={t("emptyDeliveriesTitle")} description={t("emptyDeliveriesDescription")} />
    }

    return (
      <>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-5">{t("thEvent")}</TableHead>
                <TableHead className="h-11 px-5">{t("thBooking")}</TableHead>
                <TableHead className="h-11 px-5">{t("thStatus")}</TableHead>
                <TableHead className="h-11 px-5">{t("thResponse")}</TableHead>
                <TableHead className="h-11 px-5">{t("thDate")}</TableHead>
                <TableHead className="h-11 px-5 text-right">{t("thActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[18rem] px-5 py-4 align-top whitespace-normal">
                    <p className="font-mono text-xs font-medium text-foreground">{item.eventType}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={item.endpointUrl}>
                      {item.endpointUrl}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[12rem] px-5 py-4 align-top whitespace-normal">{renderBooking(item)}</TableCell>
                  <TableCell className="px-5 py-4 align-top">{renderStatusBadge(item.status)}</TableCell>
                  <TableCell className="px-5 py-4 align-top text-sm whitespace-normal">
                    <p className="text-foreground">{describeResponse(item) ?? "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("attempts", { count: item.attempt })}</p>
                    {item.error && item.status !== "SUCCEEDED" ? (
                      <p className="mt-1 max-w-[14rem] truncate text-xs text-destructive" title={item.error}>
                        {item.error}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-5 py-4 align-top text-sm whitespace-normal text-muted-foreground">
                    {renderDeliveryTiming(item)}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-right align-top">{renderResendButton(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="divide-y divide-border/70 md:hidden">
          {deliveries.map((item) => (
            <li key={item.id} className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs font-medium text-foreground">{item.eventType}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{item.endpointUrl}</p>
                </div>
                <div className="shrink-0">{renderStatusBadge(item.status)}</div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{t("thBooking")}</dt>
                  <dd className="mt-0.5">{renderBooking(item)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("thResponse")}</dt>
                  <dd className="mt-0.5 text-foreground">
                    {describeResponse(item) ?? "-"}
                    <span className="block text-muted-foreground">{t("attempts", { count: item.attempt })}</span>
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{renderDeliveryTiming(item)}</p>
              {renderResendButton(item, "w-full")}
            </li>
          ))}
        </ul>

        {data.deliveries.totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("pageOf", { page: data.deliveries.page, totalPages: data.deliveries.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || data.deliveries.page <= 1}
                onClick={() => void loadPage(data.deliveries.page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || data.deliveries.page >= data.deliveries.totalPages}
                onClick={() => void loadPage(data.deliveries.page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  function renderBody() {
    if (loadFailed && !data) {
      return (
        <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50">
              <AlertTriangle className="size-6 text-red-600" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{t("errorTitle")}</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("errorDescription")}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-6 active:scale-[0.98]"
              onClick={() => void loadPage(1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {t("retry")}
            </Button>
          </div>
        </Card>
      )
    }

    if (!data) {
      return (
        <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
          <SectionRowsSkeleton />
        </Card>
      )
    }

    return (
      <>
        <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-foreground">{t("endpointsTitle")}</h3>
            <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
              {t("endpointsCount", { count: endpoints.length })}
            </Badge>
          </div>
          {renderEndpoints()}
        </Card>

        <Card className="relative overflow-hidden border-border/70 bg-white py-0 shadow-sm">
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                {t("refreshing")}
              </div>
            </div>
          ) : null}
          <div className="space-y-1 border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t("deliveriesTitle")}</h3>
              <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
                {t("deliveriesCount", { count: data.deliveries.totalCount })}
              </Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{t("deliveriesDescription")}</p>
          </div>
          {renderDeliveries()}
        </Card>
      </>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="partner-endpoints-title">
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <CardContent className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                <Webhook className="size-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h2 id="partner-endpoints-title" className="text-xl font-semibold tracking-tight text-foreground">
                  {t("title")}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
              </div>
            </div>
            {canManage && data ? (
              <Button
                type="button"
                variant="outline"
                className="w-full active:scale-[0.98] sm:w-auto"
                disabled={isLoading}
                onClick={() => void loadPage(data.deliveries.page)}
              >
                <RefreshCw className={cn("size-4", isLoading && "animate-spin motion-reduce:animate-none")} />
                {t("refresh")}
              </Button>
            ) : null}
          </div>

          {canManage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-[var(--contrazy-bg-muted)]/55 p-3.5">
              <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">{t("manageHintTitle")}</p>
                <p className="leading-6 break-words text-muted-foreground">{t("manageHint")}</p>
              </div>
            </div>
          ) : (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <ShieldAlert className="size-4" />
              <AlertTitle>{t("ownerOnlyTitle")}</AlertTitle>
              <AlertDescription>{t("ownerOnly")}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {canManage ? renderBody() : null}
    </section>
  )
}
