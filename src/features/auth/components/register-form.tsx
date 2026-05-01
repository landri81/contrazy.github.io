"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { registerSchema } from "@/features/auth/schemas/auth.schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GoogleIcon } from "@/components/ui/google-icon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)

  async function handleRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsedPayload = registerSchema.safeParse({
      name,
      businessName,
      email,
      password,
    })

    if (!parsedPayload.success) {
      setError(parsedPayload.error.issues[0]?.message ?? "Invalid form data")
      return
    }

    try {
      setIsPending(true)
      const registrationResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedPayload.data),
      })

      const registrationPayload = await registrationResponse.json()

      if (!registrationResponse.ok) {
        setError(registrationPayload.message ?? "Unable to create account")
        return
      }

      const signInResult = await signIn("credentials", {
        email: parsedPayload.data.email,
        password: parsedPayload.data.password,
        redirect: false,
      })

      if (signInResult?.error) {
        router.push("/login")
        return
      }

      router.push("/vendor/profile")
      router.refresh()
    } catch (registrationError) {
      console.error(registrationError)
      setError("Unable to create account right now")
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
          {isGooglePending ? "Redirecting to Google..." : "Sign up with Google"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={handleRegistration}>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Aziz Landri"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              type="text"
              placeholder="LOCAZ SARL"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Business Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="contact@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
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
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Create Vendor Account
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
