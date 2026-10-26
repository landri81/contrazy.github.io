"use client"

import { useLocale, useTranslations } from "next-intl"
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trash2,
} from "lucide-react"
import { useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { PartnerApiKeyRowsSkeleton } from "@/features/partner-api/components/partner-api-keys-skeleton"
import type { PartnerApiKeyListItem, PartnerApiKeyListPage } from "@/features/partner-api/server/api-keys"
import { PARTNER_API_SCOPES, type PartnerApiScope } from "@/lib/partner-api/scopes"
import { cn } from "@/lib/utils"

const NAME_MAX = 80
const DEFAULT_SCOPES: PartnerApiScope[] = ["bookings:read", "bookings:write"]

const SCOPE_MESSAGE_KEYS: Record<PartnerApiScope, "bookingsRead" | "bookingsWrite" | "chargesWrite" | "webhooksWrite"> = {
  "bookings:read": "bookingsRead",
  "bookings:write": "bookingsWrite",
  "charges:write": "chargesWrite",
  "webhooks:write": "webhooksWrite",
}

type ApiResponse = {
  success?: boolean
  message?: string
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

export function PartnerApiKeysManager({
  initialData,
  canManage,
  mode,
}: {
  initialData: PartnerApiKeyListPage | null
  canManage: boolean
  mode: "TEST" | "LIVE"
}) {
  const t = useTranslations("dashboard.vendor.apiKeys")
  const locale = useLocale()
  const requestSequenceRef = useRef(0)

  const [data, setData] = useState<PartnerApiKeyListPage | null>(initialData)
  const [loadFailed, setLoadFailed] = useState(initialData === null)
  const [isLoading, setIsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<PartnerApiScope[]>(DEFAULT_SCOPES)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; scopes?: string }>({})
  const [isCreating, setIsCreating] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Sticky: stays true after the "Copied" label resets, so closing is not guarded again.
  const [hasCopied, setHasCopied] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<PartnerApiKeyListItem | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const items = data?.items ?? []
  const modeLabel = mode === "LIVE" ? t("modeLive") : t("modeTest")

  async function loadPage(page: number) {
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    setIsLoading(true)

    try {
      const response = await fetch(`/api/vendor/api-keys?page=${page}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as (PartnerApiKeyListPage & ApiResponse) | null

      if (!response.ok || !payload?.items) {
        throw new Error(payload?.message ?? t("errorDescription"))
      }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      setData({
        items: payload.items,
        totalCount: payload.totalCount,
        activeCount: payload.activeCount,
        page: payload.page,
        pageSize: payload.pageSize,
        totalPages: payload.totalPages,
      })
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

  function openCreateDialog() {
    setName("")
    setScopes(DEFAULT_SCOPES)
    setFieldErrors({})
    setCreatedSecret(null)
    setCopied(false)
    setHasCopied(false)
    setConfirmDiscard(false)
    setCreateOpen(true)
  }

  function closeCreateDialog() {
    if (isCreating) {
      return
    }

    setCreateOpen(false)
    // Drop the clear key from memory as soon as the dialog closes.
    setCreatedSecret(null)
    setCopied(false)
    setHasCopied(false)
    setConfirmDiscard(false)
  }

  // Every close attempt (Escape, overlay, X, Done) goes through here. The key
  // can never be shown again, so an uncopied key needs an explicit confirmation.
  function requestCloseCreateDialog() {
    if (isCreating) {
      return
    }

    if (createdSecret && !hasCopied) {
      setConfirmDiscard(true)
      return
    }

    closeCreateDialog()
  }

  function toggleScope(scope: PartnerApiScope, checked: boolean) {
    setScopes((current) =>
      checked ? PARTNER_API_SCOPES.filter((item) => item === scope || current.includes(item)) : current.filter((item) => item !== scope)
    )
    setFieldErrors((current) => ({ ...current, scopes: undefined }))
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    const nextErrors: { name?: string; scopes?: string } = {}

    if (!trimmedName) {
      nextErrors.name = t("nameRequired")
    }

    if (scopes.length === 0) {
      nextErrors.scopes = t("scopesRequired")
    }

    setFieldErrors(nextErrors)

    if (nextErrors.name || nextErrors.scopes) {
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch("/api/vendor/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, scopes }),
      })
      const payload = (await response.json().catch(() => null)) as
        | (ApiResponse & { apiKey?: PartnerApiKeyListItem; secret?: string })
        | null

      if (!response.ok || !payload?.apiKey || !payload.secret) {
        throw new Error(payload?.message ?? t("genericError"))
      }

      setCreatedSecret(payload.secret)
      toast({
        variant: "success",
        title: t("createdToast"),
        description: t("createdToastDesc", { name: payload.apiKey.name }),
      })
      void loadPage(1)
    } catch (error) {
      toast({
        variant: "error",
        title: t("createError"),
        description: error instanceof Error ? error.message : t("genericError"),
      })
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopy() {
    if (!createdSecret) {
      return
    }

    try {
      await navigator.clipboard.writeText(createdSecret)
      setCopied(true)
      setHasCopied(true)
      setConfirmDiscard(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: "warning", title: t("copyFailed") })
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) {
      return
    }

    setIsRevoking(true)

    try {
      const response = await fetch(`/api/vendor/api-keys/${encodeURIComponent(revokeTarget.id)}/revoke`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as (ApiResponse & { apiKey?: PartnerApiKeyListItem }) | null

      if (!response.ok || !payload?.apiKey) {
        throw new Error(payload?.message ?? t("genericError"))
      }

      const revoked = payload.apiKey
      setData((current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === revoked.id ? revoked : item)) }
          : current
      )
      toast({
        variant: "success",
        title: t("revokedToast"),
        description: t("revokedToastDesc", { name: revoked.name }),
      })
      setRevokeTarget(null)
    } catch (error) {
      toast({
        variant: "error",
        title: t("revokeError"),
        description: error instanceof Error ? error.message : t("genericError"),
      })
    } finally {
      setIsRevoking(false)
    }
  }

  function renderScopes(item: PartnerApiKeyListItem) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {item.scopes.map((scope) => (
          <Badge
            key={scope}
            variant="outline"
            className="rounded-full border-border/80 bg-muted/40 font-mono text-[11px] text-foreground/80"
          >
            {scope}
          </Badge>
        ))}
      </div>
    )
  }

  function renderModeBadge(itemMode: "TEST" | "LIVE") {
    return itemMode === "LIVE" ? (
      <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
        {t("modeLive")}
      </Badge>
    ) : (
      <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">
        {t("modeTest")}
      </Badge>
    )
  }

  function renderStatusBadge(item: PartnerApiKeyListItem) {
    return item.revokedAt ? (
      <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
        {t("statusRevoked")}
      </Badge>
    ) : (
      <Badge variant="outline" className="rounded-full border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
        {t("statusActive")}
      </Badge>
    )
  }

  function renderRevokeButton(item: PartnerApiKeyListItem) {
    if (!canManage || item.revokedAt) {
      return null
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive active:scale-[0.98]"
        onClick={() => setRevokeTarget(item)}
      >
        <Trash2 className="size-3.5" />
        {t("revoke")}
      </Button>
    )
  }

  function renderList() {
    if (loadFailed && !data) {
      return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="alert">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="size-7 text-red-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">{t("errorTitle")}</h3>
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
      )
    }

    if (!data && isLoading) {
      return <PartnerApiKeyRowsSkeleton />
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <KeyRound className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">{t("emptyTitle")}</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("emptyDescription")}</p>
          {canManage ? (
            <Button
              type="button"
              size="lg"
              className="mt-6 bg-[var(--contrazy-teal)] text-white hover:bg-[var(--contrazy-teal)]/90 active:scale-[0.98]"
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              {t("create")}
            </Button>
          ) : null}
        </div>
      )
    }

    return (
      <>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-5">{t("thName")}</TableHead>
                <TableHead className="h-11 px-5">{t("thScopes")}</TableHead>
                <TableHead className="h-11 px-5">{t("thMode")}</TableHead>
                <TableHead className="h-11 px-5">{t("thLastUsed")}</TableHead>
                <TableHead className="h-11 px-5">{t("thCreated")}</TableHead>
                <TableHead className="h-11 px-5">{t("thStatus")}</TableHead>
                <TableHead className="h-11 px-5 text-right">{t("thActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "animate-in fade-in-0 duration-200 motion-reduce:animate-none",
                    item.revokedAt && "opacity-60"
                  )}
                  style={{ animationDelay: `${Math.min(index, 8) * 30}ms`, animationFillMode: "both" }}
                >
                  <TableCell className="px-5 py-4 align-top whitespace-normal">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{item.prefix}…</p>
                  </TableCell>
                  <TableCell className="max-w-xs px-5 py-4 align-top whitespace-normal">{renderScopes(item)}</TableCell>
                  <TableCell className="px-5 py-4 align-top">{renderModeBadge(item.mode)}</TableCell>
                  <TableCell className="px-5 py-4 align-top text-sm text-muted-foreground">
                    {formatDateTime(item.lastUsedAt, locale) ?? t("never")}
                  </TableCell>
                  <TableCell className="px-5 py-4 align-top text-sm text-muted-foreground">
                    {formatDateTime(item.createdAt, locale)}
                  </TableCell>
                  <TableCell className="px-5 py-4 align-top">{renderStatusBadge(item)}</TableCell>
                  <TableCell className="px-5 py-4 text-right align-top">{renderRevokeButton(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="divide-y divide-border/70 md:hidden">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "space-y-3 px-4 py-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none",
                item.revokedAt && "opacity-60"
              )}
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{item.prefix}…</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {renderStatusBadge(item)}
                  {renderModeBadge(item.mode)}
                </div>
              </div>
              {renderScopes(item)}
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t("thLastUsed")}</dt>
                  <dd className="mt-0.5 text-foreground">{formatDateTime(item.lastUsedAt, locale) ?? t("never")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("thCreated")}</dt>
                  <dd className="mt-0.5 text-foreground">{formatDateTime(item.createdAt, locale)}</dd>
                </div>
              </dl>
              {renderRevokeButton(item)}
            </li>
          ))}
        </ul>

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {t("pageOf", { page: data.page, totalPages: data.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || data.page <= 1}
                onClick={() => void loadPage(data.page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || data.page >= data.totalPages}
                onClick={() => void loadPage(data.page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                  <KeyRound className="size-5" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("title")}</h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data && !loadFailed ? (
                  <>
                    <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
                      {t("totalKeys", { count: data.totalCount })}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
                      {t("activeKeys", { count: data.activeCount })}
                    </Badge>
                  </>
                ) : null}
                {renderModeBadge(mode)}
              </div>
            </div>

            {canManage ? (
              <Button
                type="button"
                size="lg"
                className="w-full bg-[var(--contrazy-teal)] text-white hover:bg-[var(--contrazy-teal)]/90 active:scale-[0.98] sm:w-auto"
                onClick={openCreateDialog}
              >
                <Plus className="size-4" />
                {t("create")}
              </Button>
            ) : null}
          </div>

          {!canManage ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <ShieldAlert className="size-4" />
              <AlertTitle>{t("ownerOnlyTitle")}</AlertTitle>
              <AlertDescription>{t("ownerOnly")}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-[var(--contrazy-bg-muted)]/55 p-3.5">
            <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{t("authHintTitle")}</p>
              <p className="leading-6 text-muted-foreground">{t("authHint")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        {isLoading && data ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("refreshing")}
            </div>
          </div>
        ) : null}
        {renderList()}
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            requestCloseCreateDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {createdSecret ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 animate-in zoom-in-50 duration-200 motion-reduce:animate-none">
                    <Check className="size-3.5" />
                  </span>
                  {t("secretTitle")}
                </DialogTitle>
                <DialogDescription>{t("secretDescription")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="partner-api-key-secret">{t("secretLabel")}</Label>
                <div className="flex items-stretch gap-2">
                  <Input
                    id="partner-api-key-secret"
                    readOnly
                    value={createdSecret}
                    className="h-9 font-mono text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="shrink-0 active:scale-[0.98]"
                    onClick={() => void handleCopy()}
                  >
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="size-4" />
                <AlertDescription>{t("secretWarning")}</AlertDescription>
              </Alert>

              {confirmDiscard ? (
                <div
                  role="alertdialog"
                  aria-labelledby="partner-api-key-discard-title"
                  aria-describedby="partner-api-key-discard-description"
                  className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-900 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
                >
                  <div className="space-y-1">
                    <p id="partner-api-key-discard-title" className="text-sm font-semibold">
                      {t("discardTitle")}
                    </p>
                    <p id="partner-api-key-discard-description" className="text-sm leading-6">
                      {t("discardDescription")}
                    </p>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="active:scale-[0.98]"
                      onClick={() => setConfirmDiscard(false)}
                      autoFocus
                    >
                      {t("discardCancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="active:scale-[0.98]"
                      onClick={closeCreateDialog}
                    >
                      {t("discardConfirm")}
                    </Button>
                  </div>
                </div>
              ) : (
                <DialogFooter>
                  <Button type="button" className="active:scale-[0.98]" onClick={requestCloseCreateDialog}>
                    {t("done")}
                  </Button>
                </DialogFooter>
              )}
            </>
          ) : (
            <form onSubmit={(event) => void handleCreate(event)} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>{t("createTitle")}</DialogTitle>
                <DialogDescription>{t("createDescription")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="partner-api-key-name">{t("nameLabel")}</Label>
                <Input
                  id="partner-api-key-name"
                  value={name}
                  maxLength={NAME_MAX}
                  placeholder={t("namePlaceholder")}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "partner-api-key-name-error" : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    setFieldErrors((current) => ({ ...current, name: undefined }))
                  }}
                  disabled={isCreating}
                  autoFocus
                />
                {fieldErrors.name ? (
                  <p id="partner-api-key-name-error" className="text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>

              <fieldset className="space-y-2" aria-describedby={fieldErrors.scopes ? "partner-api-key-scopes-error" : undefined}>
                <legend className="text-sm font-medium text-foreground">{t("scopesLabel")}</legend>
                <div className="grid gap-2">
                  {PARTNER_API_SCOPES.map((scope) => {
                    const messageKey = SCOPE_MESSAGE_KEYS[scope]
                    const checked = scopes.includes(scope)

                    return (
                      <label
                        key={scope}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/50",
                          checked ? "border-[var(--contrazy-teal)]/40 bg-[var(--contrazy-teal)]/5" : "border-border/80",
                          isCreating && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={checked}
                          disabled={isCreating}
                          onCheckedChange={(value) => toggleScope(scope, value === true)}
                        />
                        <span className="space-y-0.5">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                            {t(`scopes.${messageKey}.label`)}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {scope}
                            </code>
                          </span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            {t(`scopes.${messageKey}.description`)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {fieldErrors.scopes ? (
                  <p id="partner-api-key-scopes-error" className="text-xs text-destructive">
                    {fieldErrors.scopes}
                  </p>
                ) : null}
              </fieldset>

              <p className="text-xs text-muted-foreground">{t("modeNotice", { mode: modeLabel })}</p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={requestCloseCreateDialog} disabled={isCreating}>
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[var(--contrazy-teal)] text-white hover:bg-[var(--contrazy-teal)]/90 active:scale-[0.98]"
                >
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  {isCreating ? t("creating") : t("createSubmit")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open && !isRevoking) {
            setRevokeTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>
              {revokeTarget ? t("revokeDescription", { name: revokeTarget.name, prefix: `${revokeTarget.prefix}…` }) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleRevoke()}
              disabled={isRevoking}
              className="active:scale-[0.98]"
            >
              {isRevoking ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {isRevoking ? t("revoking") : t("revokeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
