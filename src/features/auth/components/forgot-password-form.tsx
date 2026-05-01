"use client"

import { Loader2 } from "lucide-react"
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
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="team@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

          <Button type="submit" className="h-10 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
