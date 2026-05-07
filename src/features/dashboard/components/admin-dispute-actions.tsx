"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from "lucide-react"

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

type PendingAction = "review" | "vendor_wins" | "client_wins" | null

export function AdminDisputeActions({
  disputeId,
  status,
}: {
  disputeId: string
  status: string
}) {
  const router = useRouter()
  const t = useTranslations("dashboard.admin.disputeActions")
  const [pending, setPending] = useState<PendingAction>(null)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolveOutcome, setResolveOutcome] = useState<"vendor_wins" | "client_wins">("vendor_wins")
  const [resolution, setResolution] = useState("")
  const [resolveError, setResolveError] = useState<string | null>(null)

  const isResolved = status === "RESOLVED" || status === "LOST"

  async function callApi(action: string, resolution?: string) {
    const res = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, resolution }),
    })
    return { ok: res.ok, data: await res.json() }
  }

  async function handleMarkUnderReview() {
    setPending("review")
    try {
      const { ok, data } = await callApi("mark_under_review")
      if (ok) {
        toast({ variant: "info", title: t("toast.underReview"), description: t("toast.underReviewDesc") })
        router.refresh()
      } else {
        toast({ variant: "error", title: t("toast.failed"), description: data.message ?? t("toast.unableToUpdate") })
      }
    } catch {
      toast({ variant: "error", title: t("toast.networkError"), description: t("toast.unexpectedError") })
    } finally {
      setPending(null)
    }
  }

  async function handleResolve() {
    setResolveError(null)
    setPending(resolveOutcome)
    try {
      const { ok, data } = await callApi(
        resolveOutcome === "vendor_wins" ? "resolve_vendor_wins" : "resolve_client_wins",
        resolution.trim() || undefined
      )
      if (ok) {
        setResolveOpen(false)
        toast({
          variant: "success",
          title: resolveOutcome === "vendor_wins"
            ? t("toast.vendorWinsTitle")
            : t("toast.clientWinsTitle"),
          description: t("toast.bothNotified"),
        })
        router.refresh()
      } else {
        setResolveError(data.message ?? t("errors.resolutionFailed"))
      }
    } catch {
      setResolveError(t("errors.unexpected"))
    } finally {
      setPending(null)
    }
  }

  if (isResolved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-900/10">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {status === "RESOLVED" ? t("resolved.vendorFavour") : t("resolved.clientFavour")}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {/* Mark as resolved — opens outcome picker */}
        <Button
          onClick={() => {
            setResolution("")
            setResolveError(null)
            setResolveOutcome("vendor_wins")
            setResolveOpen(true)
          }}
          disabled={!!pending}
          className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
        >
          {pending === "vendor_wins" || pending === "client_wins" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 size-4" />
          )}
          {t("buttons.markResolved")}
        </Button>

        {/* Mark under review */}
        {status === "OPEN" && (
          <Button
            variant="outline"
            onClick={handleMarkUnderReview}
            disabled={!!pending}
          >
            {pending === "review" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Clock className="mr-2 size-4" />
            )}
            {t("buttons.markUnderReview")}
          </Button>
        )}

        {/* Close case */}
        <Button
          variant="outline"
          onClick={() => {
            setResolveOutcome("client_wins")
            setResolution(t("modal.defaultResolution"))
            setResolveError(null)
            setResolveOpen(true)
          }}
          disabled={!!pending}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <XCircle className="mr-2 size-4" />
          {t("buttons.closeCase")}
        </Button>
      </div>

      {/* Resolution modal */}
      <Dialog open={resolveOpen} onOpenChange={(open) => { if (!pending) setResolveOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-500" />
              {t("modal.title")}
            </DialogTitle>
            <DialogDescription>{t("modal.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Outcome selector */}
            <div className="grid grid-cols-2 gap-2">
              {(["vendor_wins", "client_wins"] as const).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => setResolveOutcome(outcome)}
                  className={`cursor-pointer rounded-xl border p-3 text-center text-[13px] font-semibold transition-all ${
                    resolveOutcome === outcome
                      ? outcome === "vendor_wins"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {outcome === "vendor_wins" ? t("modal.vendorWins") : t("modal.clientWins")}
                  <p className="mt-0.5 text-[11px] font-normal opacity-70">
                    {outcome === "vendor_wins" ? t("modal.vendorWinsDetail") : t("modal.clientWinsDetail")}
                  </p>
                </button>
              ))}
            </div>

            {/* Resolution note */}
            <div className="space-y-1.5">
              <Label htmlFor="resolution">{t("modal.resolutionLabel")}</Label>
              <Textarea
                id="resolution"
                rows={3}
                placeholder={t("modal.resolutionPlaceholder")}
                maxLength={INPUT_LIMITS.adminDisputeResolution}
                value={resolution}
                onChange={(e) => { setResolution(e.target.value); setResolveError(null) }}
              />
              <CharacterCount current={resolution.length} limit={INPUT_LIMITS.adminDisputeResolution} className="text-right" />
            </div>

            {resolveError && <p className="text-[13px] text-destructive">{resolveError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)} disabled={!!pending}>
              {t("modal.cancel")}
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!!pending}
              className={resolveOutcome === "vendor_wins"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
              }
            >
              {(pending === "vendor_wins" || pending === "client_wins") ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("modal.processing")}</>
              ) : (
                resolveOutcome === "vendor_wins" ? t("modal.returnToVendor") : t("modal.releaseToClient")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
