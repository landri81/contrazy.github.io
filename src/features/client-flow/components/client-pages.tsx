"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { isValidPhoneNumber } from "react-phone-number-input"
import { ArrowRight, Building2, CheckCircle2, Loader2, Mail, ShieldCheck, UserCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-lg border-white bg-white/95 py-0 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
        <form onSubmit={handleSubmit}>
          <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-heading text-xl font-semibold tracking-tight">Contact information</CardTitle>
                <CardDescription className="mt-1">
                  Enter the details that should appear on this transaction.
                </CardDescription>
              </div>
              <div className="hidden size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 sm:flex">
                <ShieldCheck className="size-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-5 py-5 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <UserCircle className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    required
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/60 pl-10 shadow-none focus-visible:bg-white"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/60 pl-10 shadow-none focus-visible:bg-white"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Phone Number</Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={(v) => { setPhone(v); setPhoneError(null) }}
                  onBlur={() => setPhoneError(validatePhone(phone))}
                  invalid={!!phoneError}
                  className="[&_button]:h-11 [&_button]:rounded-l-lg [&_button]:border-slate-200 [&_button]:bg-slate-50/80 [&_input]:h-11 [&_input]:rounded-r-lg [&_input]:border-slate-200 [&_input]:bg-slate-50/60 [&_input]:shadow-none [&_input:focus-visible]:bg-white"
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
                <Label htmlFor="companyName" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Company (Optional)</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="companyName"
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/60 pl-10 shadow-none focus-visible:bg-white"
                    placeholder="Enter your company name (optional)"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
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

            <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600 sm:grid-cols-3">
              {["Saved securely", "Used for receipts", "Editable before signing"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="rounded-b-lg border-t border-slate-100 bg-white px-5 py-5 sm:px-6">
            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-lg bg-[var(--contrazy-navy)] font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-[var(--contrazy-navy-soft)] disabled:cursor-not-allowed"
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
    </motion.div>
  )
}
