"use client"

import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, Loader2, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { CountryCombobox } from "@/components/ui/country-combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Textarea } from "@/components/ui/textarea"
import { formatValueLabel } from "@/features/dashboard/lib/format-value-label"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type VendorProfileFormProps = {
  initialValues: {
    fullName: string
    businessName: string
    businessEmail: string
    supportEmail: string
    businessPhone: string
    businessAddress: string
    businessCountry: string
    reviewStatus: string
    stripeConnectionStatus: string
  }
}

export function VendorProfileForm({ initialValues }: VendorProfileFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(initialValues)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const profileCompletion = useMemo(() => {
    const requiredValues = [
      form.businessName,
      form.businessEmail,
      form.supportEmail,
      form.businessPhone,
      form.businessAddress,
      form.businessCountry,
    ]
    const filled = requiredValues.filter((value) => value.trim().length > 0).length
    return Math.round((filled / requiredValues.length) * 100)
  }, [form])

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))

    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setFieldErrors({})

    const parsed = vendorProfileSchema.safeParse(form)

    if (!parsed.success) {
      const errors: Record<string, string> = {}

      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) errors[field] = issue.message
      }

      setFieldErrors(errors)
      setError("Please fix the highlighted fields and try again.")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/vendor/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Unable to save your profile.")
          return
        }

        setMessage("Business profile updated.")
        router.refresh()
      } catch (requestError) {
        console.error(requestError)
        setError("Unable to save your profile right now.")
      }
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-3">
        <ProfileStat label="Profile completion" value={`${profileCompletion}%`} accent={profileCompletion === 100} />
        <ProfileStat label="Review status" value={formatValueLabel(form.reviewStatus)} />
        <ProfileStat label="Payout setup" value={formatValueLabel(form.stripeConnectionStatus)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Account owner" htmlFor="fullName" error={fieldErrors.fullName}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Enter your full name"
            maxLength={INPUT_LIMITS.personName}
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            aria-invalid={!!fieldErrors.fullName}
          />
        </Field>
        <Field label="Business name" htmlFor="businessName" error={fieldErrors.businessName}>
          <Input
            id="businessName"
            placeholder="Enter your business name"
            maxLength={INPUT_LIMITS.businessName}
            value={form.businessName}
            onChange={(event) => updateField("businessName", event.target.value)}
            aria-invalid={!!fieldErrors.businessName}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Business email" htmlFor="businessEmail" error={fieldErrors.businessEmail}>
          <Input
            id="businessEmail"
            type="email"
            autoComplete="email"
            placeholder="Enter your business email"
            maxLength={INPUT_LIMITS.email}
            value={form.businessEmail}
            onChange={(event) => updateField("businessEmail", event.target.value)}
            aria-invalid={!!fieldErrors.businessEmail}
          />
        </Field>
        <Field label="Support email" htmlFor="supportEmail" error={fieldErrors.supportEmail}>
          <Input
            id="supportEmail"
            type="email"
            autoComplete="email"
            placeholder="Enter your support email"
            maxLength={INPUT_LIMITS.email}
            value={form.supportEmail}
            onChange={(event) => updateField("supportEmail", event.target.value)}
            aria-invalid={!!fieldErrors.supportEmail}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Business phone"
          htmlFor="businessPhone"
          error={fieldErrors.businessPhone}
          hint="Include country code, e.g. +1 202 555 0100"
        >
          <PhoneInput
            id="businessPhone"
            value={form.businessPhone}
            onChange={(value) => updateField("businessPhone", value)}
            maxLength={INPUT_LIMITS.phone}
          />
        </Field>
        <Field label="Country" htmlFor="businessCountry" error={fieldErrors.businessCountry}>
          <CountryCombobox
            id="businessCountry"
            value={form.businessCountry}
            onChange={(value) => updateField("businessCountry", value)}
            placeholder="Select your country"
          />
        </Field>
      </div>

      <Field label="Business address" htmlFor="businessAddress" error={fieldErrors.businessAddress}>
        <Textarea
          id="businessAddress"
          className="min-h-28"
          placeholder="Enter your full business address"
          maxLength={INPUT_LIMITS.address}
          value={form.businessAddress}
          onChange={(event) => updateField("businessAddress", event.target.value)}
          aria-invalid={!!fieldErrors.businessAddress}
        />
      </Field>

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
            className="flex items-center gap-2 text-sm text-emerald-600"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Button
        type="submit"
        className="h-10 gap-2 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving profile...
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save business profile
          </>
        )}
      </Button>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
  error,
  hint,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
  error?: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        </AnimatePresence>
      ) : null}
    </div>
  )
}

function ProfileStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-muted px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${accent ? "text-emerald-600" : "text-foreground"}`}>{value}</p>
    </div>
  )
}
