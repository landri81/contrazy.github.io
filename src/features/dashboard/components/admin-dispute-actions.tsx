"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
        toast({ variant: "info", title: "Marked under review", description: "The vendor has been notified." })
        router.refresh()
      } else {
        toast({ variant: "error", title: "Failed", description: data.message ?? "Unable to update status." })
      }
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
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
            ? "Vendor's claim upheld — deposit control returned"
            : "Client's claim upheld — deposit released",
          description: "Both parties have been notified by email.",
        })
        router.refresh()
      } else {
        setResolveError(data.message ?? "Resolution failed.")
      }
    } catch {
      setResolveError("An unexpected error occurred.")
    } finally {
      setPending(null)
    }
  }

  if (isResolved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-900/10">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Dispute closed — {status === "RESOLVED" ? "resolved in vendor's favour" : "resolved in client's favour"}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {/* Mark as resolved — opens outcome picker */}
        <Button
          onClick={() => { setResolution(""); setResolveError(null); setResolveOutcome("vendor_wins"); setResolveOpen(true) }}
          disabled={!!pending}
          className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
        >
          {pending === "vendor_wins" || pending === "client_wins" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 size-4" />
          )}
          Mark as resolved
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
            Mark under review
          </Button>
        )}

        {/* Close case */}
        <Button
          variant="outline"
          onClick={() => { setResolveOutcome("client_wins"); setResolution("Case closed — deposit released back to client."); setResolveError(null); setResolveOpen(true) }}
          disabled={!!pending}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <XCircle className="mr-2 size-4" />
          Close case (release deposit)
        </Button>
      </div>

      {/* Resolution modal */}
      <Dialog open={resolveOpen} onOpenChange={(open) => { if (!pending) setResolveOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-500" />
              Resolve dispute
            </DialogTitle>
            <DialogDescription>
              Choose the outcome and optionally add a resolution note visible to both parties.
            </DialogDescription>
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
                  {outcome === "vendor_wins" ? "Vendor's claim upheld" : "Client's claim upheld"}
                  <p className="mt-0.5 text-[11px] font-normal opacity-70">
                    {outcome === "vendor_wins"
                      ? "Returns deposit control to vendor"
                      : "Releases deposit to client now"}
                  </p>
                </button>
              ))}
            </div>

            {/* Resolution note */}
            <div className="space-y-1.5">
              <Label htmlFor="resolution">Resolution note (optional)</Label>
              <Textarea
                id="resolution"
                rows={3}
                placeholder="Summarise the decision for vendor and client records..."
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
              Cancel
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
                <><Loader2 className="mr-2 size-4 animate-spin" />Processing...</>
              ) : (
                resolveOutcome === "vendor_wins" ? "Return control to vendor" : "Release deposit to client"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
