"use client"

import { BadgeCheck, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PartnerPlanActionsProps = {
  userId: string
  active: boolean
  grantedAt: string | null
  grantedBy: string | null
  note: string | null
}

/**
 * Super admins grant or withdraw the partner plan (Enterprise, no Stripe billing, no end date). Withdrawing asks for a
 * second click; granting cancels a Stripe subscription still running, which the text says before the click.
 */
export function PartnerPlanActions({ userId, active, grantedAt, grantedBy, note }: PartnerPlanActionsProps) {
  const router = useRouter()
  const t = useTranslations("dashboard.admin.vendorManager.subscription.partner")
  const [draftNote, setDraftNote] = useState("")
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function send(method: "POST" | "DELETE") {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/partner-plan`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ note: draftNote.trim() || null }) : undefined,
        })
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        if (!response.ok) {
          setError(payload.message ?? t("errors.failed"))
          return
        }
        setConfirmingRevoke(false)
        setDraftNote("")
        router.refresh()
      } catch {
        setError(t("errors.network"))
      }
    })
  }

  return (
    <div className="space-y-4" data-testid="partner-plan" data-active={active}>
      {active ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">{t("activeTitle")}</p>
            <p className="text-emerald-700 dark:text-emerald-400">{t("granted", { date: grantedAt ?? "—", by: grantedBy ?? "—" })}</p>
            {note ? <p className="text-emerald-700 dark:text-emerald-400">{t("noteValue", { note })}</p> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="max-w-prose text-sm text-muted-foreground">{t("explain")}</p>
          <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
            <Input value={draftNote} onChange={(event) => setDraftNote(event.target.value)} maxLength={200} placeholder={t("notePlaceholder")} aria-label={t("noteLabel")} disabled={isPending} />
            <Button type="button" onClick={() => send("POST")} disabled={isPending} data-testid="partner-plan-grant">
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("grant")}
            </Button>
          </div>
        </div>
      )}

      {active ? (
        <div className="flex flex-wrap items-center gap-2">
          {confirmingRevoke ? (
            <>
              <span className="text-sm text-red-700 dark:text-red-400">{t("revokeConfirm")}</span>
              <Button type="button" variant="destructive" size="sm" onClick={() => send("DELETE")} disabled={isPending} data-testid="partner-plan-revoke-confirm">
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("revokeYes")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingRevoke(false)} disabled={isPending}>
                {t("cancel")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingRevoke(true)} data-testid="partner-plan-revoke">
              {t("revoke")}
            </Button>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
