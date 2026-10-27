"use client"

import { Link2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

type PlatformConnectionActionsProps = {
  userId: string
  platform: string
  platformName: string
  connection: { connectedAt: string; keyPrefix: string | null; keyMode: string | null } | null
}

/**
 * Super admins connect or disconnect a partner platform (LOCAZ) for this vendor account: Contrazy creates the key and
 * the webhook and hands them to the platform; no one signs in to the vendor account. Disconnecting asks twice.
 */
export function PlatformConnectionActions({ userId, platform, platformName, connection }: PlatformConnectionActionsProps) {
  const router = useRouter()
  const t = useTranslations("dashboard.admin.vendorManager.subscription.platform")
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function send(method: "POST" | "DELETE") {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/platforms/${platform}`, { method })
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        if (!response.ok) {
          setError(payload.message ?? t("errors.failed"))
          return
        }
        setConfirming(false)
        router.refresh()
      } catch {
        setError(t("errors.network"))
      }
    })
  }

  return (
    <div className="space-y-4" data-testid="platform-connection" data-connected={Boolean(connection)}>
      {connection ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <Link2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">{t("connected", { name: platformName })}</p>
            <p className="text-emerald-700 dark:text-emerald-400">{t("details", { date: new Date(connection.connectedAt).toLocaleString(), key: connection.keyPrefix ?? "—", mode: connection.keyMode ?? "—" })}</p>
          </div>
        </div>
      ) : (
        <p className="max-w-prose text-sm text-muted-foreground">{t("explain", { name: platformName })}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {connection && confirming ? (
          <>
            <span className="text-sm text-red-700 dark:text-red-400">{t("disconnectConfirm", { name: platformName })}</span>
            <Button type="button" variant="destructive" size="sm" onClick={() => send("DELETE")} disabled={isPending} data-testid="platform-disconnect-confirm">
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("disconnectYes")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={() => send("POST")} disabled={isPending} data-testid="platform-connect">
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {connection ? t("reconnect", { name: platformName }) : t("connect", { name: platformName })}
            </Button>
            {connection ? (
              <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={isPending} data-testid="platform-disconnect">
                {t("disconnect")}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
