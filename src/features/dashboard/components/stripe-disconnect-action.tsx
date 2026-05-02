"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Unlink } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"

export function StripeDisconnectAction() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function open() {
    setIsOpen(true)
    setConfirmed(false)
    setError(null)
  }

  function cancel() {
    if (isPending) return
    setIsOpen(false)
    setConfirmed(false)
    setError(null)
  }

  function handleDisconnect() {
    if (!confirmed || isPending) return
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch("/api/vendor/stripe/connect", { method: "DELETE" })
        const data = await res.json()

        if (!res.ok) {
          setError(data.message ?? "Failed to disconnect. Please try again.")
          return
        }

        router.push("/vendor/stripe?status=disconnected")
        router.refresh()
      } catch {
        setError("An unexpected error occurred. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-3">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 cursor-pointer border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
          onClick={open}
        >
          <Unlink className="size-4" />
          Disconnect Stripe
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900 dark:bg-red-950/20"
          >
            {/* Warning header */}
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Disconnect Stripe account?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-700/90 dark:text-red-400/90">
                  This will remove the Stripe link from your profile and reset your payout status to <strong>Not connected</strong>.
                </p>
              </div>
            </div>

            {/* What this affects */}
            <ul className="mt-4 space-y-1.5 border-t border-red-200/60 pt-4 dark:border-red-800/40">
              {[
                "You will not be able to collect payments or deposits until you reconnect.",
                "New transactions requiring payment will be blocked.",
                "Your Stripe account itself is not deleted — only the link is removed.",
                "Active transactions with pending payments must be resolved first.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-red-700/80 dark:text-red-400/80">
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-red-400" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Confirmation checkbox */}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-red-200 bg-white/60 p-3 dark:border-red-800 dark:bg-black/10">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-red-600"
              />
              <span className="text-xs font-medium text-red-800 dark:text-red-300">
                I understand that disconnecting will pause all payment capabilities until I reconnect.
              </span>
            </label>

            {/* Error */}
            {error ? (
              <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>
            ) : null}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                disabled={!confirmed || isPending}
                onClick={handleDisconnect}
                className="h-9 cursor-pointer bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                {isPending ? "Disconnecting…" : "Confirm disconnect"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 cursor-pointer"
                disabled={isPending}
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
