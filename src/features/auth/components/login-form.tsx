"use client"

import { Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { loginSchema } from "@/features/auth/schemas/auth.schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleHomePath } from "@/lib/auth/pathing"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleCredentialsSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsedPayload = loginSchema.safeParse({ email, password })

    if (!parsedPayload.success) {
      setError(parsedPayload.error.issues[0]?.message ?? "Invalid email or password")
      return
    }

    try {
      setIsPending(true)
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (response?.error) {
        setError("Invalid email or password")
        return
      }

      const sessionResponse = await fetch("/api/auth/session")
      const session = await sessionResponse.json()

      router.push(getRoleHomePath(session?.user?.role))

      router.refresh()
    } catch (signInError) {
      console.error(signInError)
      setError("Unable to sign in right now")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border bg-card/80 py-6 shadow-sm">
      <CardContent>
        <form className="space-y-4" onSubmit={handleCredentialsSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@contrazy.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="************"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="h-10 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => signIn("google", { callbackUrl: "/auth-complete" })}
          >
            Continue with Google
          </Button>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create vendor account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Forgot password?{" "}
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Reset access
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
