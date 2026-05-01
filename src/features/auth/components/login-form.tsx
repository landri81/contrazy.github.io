"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { loginSchema } from "@/features/auth/schemas/auth.schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GoogleIcon } from "@/components/ui/google-icon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRoleHomePath } from "@/lib/auth/pathing"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)

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

  function handleGoogleSignIn() {
    setIsGooglePending(true)
    signIn("google", { callbackUrl: "/auth-complete" })
  }

  return (
    <Card className="border-border/70 bg-card/70 py-6 shadow-none">
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-3 border-border/70 bg-background/80 font-medium shadow-sm hover:bg-background"
          onClick={handleGoogleSignIn}
          disabled={isGooglePending || isPending}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
            {isGooglePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
          </span>
          {isGooglePending ? "Redirecting to Google..." : "Continue with Google"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="************"
                className="pr-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide characters" : "Show characters"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <Button
            type="submit"
            className="h-11 w-full gap-2 bg-[var(--contrazy-navy)] font-medium text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={isPending || isGooglePending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create vendor account
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
