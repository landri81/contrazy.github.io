"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { isValidPhoneNumber } from "react-phone-number-input"
import { ArrowRight, Building2, Loader2, Mail, UserCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"

export function ClientProfileForm({
  token,
  initialData,
}: {
  token: string
  initialData?: {
    fullName?: string
    email?: string
    phone?: string | null
    companyName?: string | null
  } | null
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [fullName, setFullName] = useState(initialData?.fullName || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [phone, setPhone] = useState(initialData?.phone || "")
  const [companyName, setCompanyName] = useState(initialData?.companyName || "")

  function validatePhone(value: string): string | null {
    if (!value.trim()) return null
    const localPart = value.replace(/^\+\d+\s*/, "").trim()
    if (!localPart) return null
    return isValidPhoneNumber(value) ? null : "Please enter a valid phone number"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const phoneValidationError = validatePhone(phone)
    if (phoneValidationError) {
      setPhoneError(phoneValidationError)
      return
    }

    setIsPending(true)
    try {
      const res = await fetch(`/api/client/${token}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, companyName }),
      })

      if (res.ok) {
        const payload = await res.json()
        router.push(`/t/${token}/${payload.nextStep ?? "documents"}`)
        return
      }

      if (res.status === 410) {
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await res.json().catch(() => null)
      setError(payload?.message ?? "Unable to save details right now")
    } catch (err) {
      console.error(err)
      setError("Unable to save details right now")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <UserCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="fullName"
                required
                className="pl-9"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                className="pl-9"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              id="phone"
              value={phone}
              onChange={(v) => { setPhone(v); setPhoneError(null) }}
              onBlur={() => setPhoneError(validatePhone(phone))}
              invalid={!!phoneError}
            />
            <AnimatePresence initial={false}>
              {phoneError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs text-destructive"
                >
                  {phoneError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company (Optional)</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="companyName"
                className="pl-9"
                placeholder="Enter your company name (optional)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="h-11 w-full gap-2 bg-(--contrazy-navy) font-medium text-white hover:bg-(--contrazy-navy-soft)"
            disabled={isPending || !fullName || !email}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
