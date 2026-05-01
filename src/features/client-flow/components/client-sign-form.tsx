"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, PenSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function ClientSignForm({ token }: { token: string }) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!agreed) {
      return
    }

    setIsPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/client/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true }),
      })

      if (response.ok) {
        const payload = await response.json()
        router.push(`/t/${token}/${payload.nextStep ?? "payment"}`)
      } else {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? "Unable to record your signature right now.")
      }
    } catch (error) {
      console.error(error)
      setError("Unable to record your signature right now.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenSquare className="h-5 w-5" />
            Confirm Signature
          </CardTitle>
          <CardDescription>
            Use the built-in confirmation below to accept this agreement electronically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="flex items-start space-x-3 rounded-xl border border-border/70 bg-primary/5 p-4">
            <Checkbox id="signature-confirmation" checked={agreed} onCheckedChange={(value: boolean) => setAgreed(value)} />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="signature-confirmation" className="text-base font-medium">
                I confirm that I accept this agreement
              </Label>
              <p className="text-sm text-muted-foreground">
                This confirmation will be recorded with the transaction as your electronic signature.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={isPending || !agreed}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign and Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
