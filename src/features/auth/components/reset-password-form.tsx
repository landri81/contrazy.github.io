"use client"

import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPasswordSchema } from "@/features/auth/schemas/auth.schema"

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const parsed = resetPasswordSchema.safeParse({ token, password })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reset request")
      return
    }

    try {
      setIsPending(true)
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.message ?? "Unable to reset password")
        return
      }

      setMessage("Password updated. Redirecting to login...")
      setTimeout(() => {
        router.push("/login")
      }, 800)
    } catch (requestError) {
      console.error(requestError)
      setError("Unable to reset password right now")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border bg-card/80 py-6 shadow-sm">
      <CardContent>
        {!token ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">This password reset link is missing or has expired.</p>
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

            <Button type="submit" className="h-10 w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
