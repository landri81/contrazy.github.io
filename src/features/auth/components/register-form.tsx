"use client"

import { Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { registerSchema } from "@/features/auth/schemas/auth.schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

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

  return (
    <Card className="border-border bg-card/80 py-6 shadow-sm">
      <CardContent>
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

          <Button type="submit" className="h-10 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Vendor Account"
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
