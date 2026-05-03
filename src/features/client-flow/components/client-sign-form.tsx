"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, PenLine, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SignaturePad } from "@/components/ui/signature-pad"

export function ClientSignForm({ token }: { token: string }) {
  const router = useRouter()
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!signatureDataUrl) return

    setIsPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/client/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      })

      if (response.ok) {
        const payload = await response.json()
        router.push(`/t/${token}/${payload.nextStep ?? "payment"}`)
        return
      }

      if (response.status === 410) {
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await response.json().catch(() => null)
      setError(payload?.message ?? "Unable to record your signature right now.")
    } catch (err) {
      console.error(err)
      setError("Unable to record your signature right now.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Canvas card */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5 sm:px-5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--contrazy-navy)/10">
            <PenLine className="size-4 text-(--contrazy-navy)" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Draw your signature</p>
            <p className="truncate text-xs text-muted-foreground">
              Use your finger, stylus, or mouse
            </p>
          </div>
        </div>

        {/* Signature canvas */}
        <div className="p-3 sm:p-4">
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <SignaturePad onChange={setSignatureDataUrl} />

          {/* Status hint */}
          <div className="mt-2.5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground/60">
              {signatureDataUrl ? "Signature captured — ready to submit" : "Signature required to continue"}
            </p>
            {signatureDataUrl && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Ready
              </motion.span>
            )}
          </div>
        </div>
      </div>

      {/* Legal notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          By tapping <strong className="font-medium text-foreground">Sign and Continue</strong>, you confirm your intent to sign electronically. Your signature, name, email, timestamp, and IP address will be recorded.
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.98]"
        disabled={isPending || !signatureDataUrl}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Recording signature…
          </>
        ) : (
          <>
            <PenLine className="mr-2 size-5" />
            Sign and Continue
          </>
        )}
      </Button>
    </form>
  )
}
