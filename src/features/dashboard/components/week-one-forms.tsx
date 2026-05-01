"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"

function formatValueLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

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
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    const parsed = vendorProfileSchema.safeParse(form)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please review the form and try again.")
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
        <ProfileStat label="Profile completion" value={`${profileCompletion}%`} />
        <ProfileStat label="Review status" value={formatValueLabel(form.reviewStatus)} />
        <ProfileStat label="Payout setup" value={formatValueLabel(form.stripeConnectionStatus)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Account owner" htmlFor="fullName">
          <Input id="fullName" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
        </Field>
        <Field label="Business name" htmlFor="businessName">
          <Input id="businessName" value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} />
        </Field>
        <Field label="Business email" htmlFor="businessEmail">
          <Input
            id="businessEmail"
            type="email"
            value={form.businessEmail}
            onChange={(event) => updateField("businessEmail", event.target.value)}
          />
        </Field>
        <Field label="Support email" htmlFor="supportEmail">
          <Input
            id="supportEmail"
            type="email"
            value={form.supportEmail}
            onChange={(event) => updateField("supportEmail", event.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor="businessPhone">
          <Input
            id="businessPhone"
            value={form.businessPhone}
            onChange={(event) => updateField("businessPhone", event.target.value)}
          />
        </Field>
        <Field label="Country" htmlFor="businessCountry">
          <Input
            id="businessCountry"
            value={form.businessCountry}
            onChange={(event) => updateField("businessCountry", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Business address" htmlFor="businessAddress">
        <Textarea
          id="businessAddress"
          className="min-h-28"
          value={form.businessAddress}
          onChange={(event) => updateField("businessAddress", event.target.value)}
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <Button type="submit" className="h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving profile...
          </>
        ) : (
          "Save business profile"
        )}
      </Button>
    </form>
  )
}

export function VendorReviewActions({
  userId,
  currentStatus,
}: {
  userId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function updateStatus(reviewStatus: "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING") {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewStatus }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Unable to update review status.")
          return
        }

        setMessage(`Review status updated to ${reviewStatus.toLowerCase()}.`)
        router.refresh()
      } catch (requestError) {
        console.error(requestError)
        setError("Unable to update review status right now.")
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Current review status: {formatValueLabel(currentStatus)}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isPending}
          onClick={() => updateStatus("APPROVED")}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          disabled={isPending}
          onClick={() => updateStatus("PENDING")}
        >
          Mark pending
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={isPending}
          onClick={() => updateStatus("REJECTED")}
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-800"
          disabled={isPending}
          onClick={() => updateStatus("SUSPENDED")}
        >
          Suspend
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
