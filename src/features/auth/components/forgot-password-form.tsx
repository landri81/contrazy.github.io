"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPasswordSchema } from "@/features/auth/schemas/auth.schema"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const parsed = forgotPasswordSchema.safeParse({ email })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email")
      return
    }

    try {
      setIsPending(true)
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.message ?? "Unable to request reset link")
        return
      }

      setMessage("If the account exists, a reset link has been issued.")
    } catch (requestError) {
      console.error(requestError)
      setError("Unable to request reset link right now")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border bg-card/80 py-6 shadow-sm">
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="team@business.com"
                className="pl-9"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            ) : message ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{message}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Button type="submit" className="h-11 w-full gap-2 font-medium" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Send reset link
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
