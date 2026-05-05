"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ContractDocumentViewer } from "@/features/contracts/components/contract-document-viewer"

export function ContractReviewForm({ token, contentHtml }: { token: string, contentHtml: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewed) return
    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/client/${token}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: true })
      })

      if (res.ok) {
        const payload = await res.json()
        router.push(`/t/${token}/${payload.nextStep ?? "sign"}`)
      } else {
        if (res.status === 410) {
          router.replace(`/t/${token}/cancelled`)
          return
        }

        const payload = await res.json().catch(() => null)
        setError(payload?.message ?? "Unable to continue right now.")
      }
    } catch (err) {
      console.error(err)
      setError("Unable to continue right now.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="rounded-[28px] border border-border/70 bg-[var(--contrazy-bg-muted)]/70 p-3 sm:p-5">
            <ContractDocumentViewer
              html={contentHtml}
              layout="paged"
              className="mx-auto max-w-[1100px]"
            />
          </div>

          <div className="flex items-start space-x-3 rounded-xl border border-border/70 bg-primary/5 p-4">
            <Checkbox 
              id="reviewed" 
              checked={reviewed} 
              onCheckedChange={(c: boolean) => setReviewed(c)} 
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="reviewed" className="text-base font-medium">
                I have reviewed this agreement
              </Label>
              <p className="text-sm text-muted-foreground">
                Continue to the next step when you are ready to sign.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={isPending || !reviewed}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Signature
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
