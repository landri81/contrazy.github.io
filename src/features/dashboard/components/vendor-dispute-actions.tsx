"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Loader2, Unlock, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type Action = "resolve_keep" | "resolve_release" | null

export function VendorDisputeActions({
  transactionId,
  status,
}: {
  transactionId: string
  status: string
}) {
  const router = useRouter()
  const t = useTranslations("dashboard.vendor.disputeActions")
  const [pending, setPending] = useState<Action>(null)
  const [dialogAction, setDialogAction] = useState<"resolve_keep" | "resolve_release" | null>(null)
  const [resolution, setResolution] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isResolved = status === "RESOLVED" || status === "LOST"

  function openDialog(action: "resolve_keep" | "resolve_release") {
    setResolution("")
    setError(null)
    setDialogAction(action)
  }

  async function handleConfirm() {
    if (!dialogAction) return
    setError(null)
    setPending(dialogAction)

    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/dispute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: dialogAction, resolution: resolution.trim() || undefined }),
      })
      const data = await res.json()

      if (res.ok) {
        setDialogAction(null)
        toast({
          variant: "success",
          title: dialogAction === "resolve_keep" ? t("toast.keptTitle") : t("toast.releasedTitle"),
          description: t("toast.bothNotified"),
        })
        router.refresh()
      } else {
        setError(data.message ?? t("errors.unexpected"))
      }
    } catch {
      setError(t("errors.network"))
    } finally {
      setPending(null)
    }
  }

  if (isResolved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-900/10">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {status === "RESOLVED" ? t("resolved.kept") : t("resolved.released")}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 mb-4 dark:border-amber-900 dark:bg-amber-900/10">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{t("banner.title")}</span>{" "}{t("banner.body")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => openDialog("resolve_keep")}
          disabled={!!pending}
          className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
        >
          <Wallet className="mr-2 size-4" />
          {t("buttons.keep")}
        </Button>

        <Button
          variant="outline"
          onClick={() => openDialog("resolve_release")}
          disabled={!!pending}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Unlock className="mr-2 size-4" />
          {t("buttons.release")}
        </Button>
      </div>

      <Dialog open={!!dialogAction} onOpenChange={(open) => { if (!pending && !open) setDialogAction(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogAction === "resolve_keep" ? (
                <><Wallet className="size-5 text-emerald-500" /> {t("modal.keepTitle")}</>
              ) : (
                <><Unlock className="size-5 text-destructive" /> {t("modal.releaseTitle")}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "resolve_keep" ? t("modal.keepDescription") : t("modal.releaseDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dispute-resolution">{t("modal.resolutionLabel")}</Label>
              <Textarea
                id="dispute-resolution"
                rows={3}
                placeholder={t("modal.resolutionPlaceholder")}
                maxLength={INPUT_LIMITS.adminDisputeResolution}
                value={resolution}
                onChange={(e) => { setResolution(e.target.value); setError(null) }}
              />
              <CharacterCount current={resolution.length} limit={INPUT_LIMITS.adminDisputeResolution} className="text-right" />
            </div>

            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)} disabled={!!pending}>
              {t("modal.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!!pending}
              className={dialogAction === "resolve_keep"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {pending ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("modal.processing")}</>
              ) : dialogAction === "resolve_keep" ? (
                t("modal.confirmKeep")
              ) : (
                t("modal.confirmRelease")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
