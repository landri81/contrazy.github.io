"use client"

import { Globe, Loader2, LockKeyhole } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { CountryCombobox } from "@/components/ui/country-combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"

type VendorProfileFormValues = {
  ownerFirstName: string
  ownerLastName: string
  businessName: string
  businessEmail: string
  supportEmail: string
  businessPhone: string
  businessAddress: string
  businessCountry: string
  registrationNumber: string
  vatNumber: string
  preferredLocale: "en" | "fr"
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function AdminVendorProfileForm({
  userId,
  initialValues,
}: {
  userId: string
  initialValues: VendorProfileFormValues
}) {
  const router = useRouter()
  const t = useTranslations("dashboard.vendor.profileForm")
  const tActions = useTranslations("dashboard.admin.userActions")
  const [form, setForm] = useState(initialValues)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function updateField(field: keyof VendorProfileFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }))

    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  function resetForm() {
    setForm(initialValues)
    setFieldErrors({})
    setError(null)
    setMessage(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setFieldErrors({})

    const parsed = vendorProfileSchema.safeParse(form)

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}

      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string
        if (field && !nextErrors[field]) {
          nextErrors[field] = issue.message
        }
      }

      setFieldErrors(nextErrors)
      setError(t("messages.fixErrors"))
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/vendor-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? tActions("errors.updateFailed"))
          return
        }

        setMessage(t("messages.success"))
        router.refresh()
      } catch {
        setError(tActions("errors.requestFailed"))
      }
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("fields.firstName")}
          htmlFor="admin-owner-first-name"
          error={fieldErrors.ownerFirstName}
        >
          <Input
            id="admin-owner-first-name"
            value={form.ownerFirstName}
            onChange={(event) => updateField("ownerFirstName", event.target.value)}
            placeholder={t("placeholders.firstName")}
            maxLength={INPUT_LIMITS.personName}
            aria-invalid={!!fieldErrors.ownerFirstName}
          />
        </Field>

        <Field
          label={t("fields.lastName")}
          htmlFor="admin-owner-last-name"
          error={fieldErrors.ownerLastName}
        >
          <Input
            id="admin-owner-last-name"
            value={form.ownerLastName}
            onChange={(event) => updateField("ownerLastName", event.target.value)}
            placeholder={t("placeholders.lastName")}
            maxLength={INPUT_LIMITS.personName}
            aria-invalid={!!fieldErrors.ownerLastName}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("fields.businessName")}
          htmlFor="admin-business-name"
          error={fieldErrors.businessName}
        >
          <Input
            id="admin-business-name"
            value={form.businessName}
            onChange={(event) => updateField("businessName", event.target.value)}
            placeholder={t("placeholders.businessName")}
            maxLength={INPUT_LIMITS.businessName}
            aria-invalid={!!fieldErrors.businessName}
          />
        </Field>

        <Field
          label={t("fields.registrationNumber")}
          htmlFor="admin-registration-number"
          error={fieldErrors.registrationNumber}
        >
          <Input
            id="admin-registration-number"
            value={form.registrationNumber}
            onChange={(event) => updateField("registrationNumber", event.target.value)}
            placeholder={t("placeholders.registrationNumber")}
            maxLength={INPUT_LIMITS.registrationNumber}
            aria-invalid={!!fieldErrors.registrationNumber}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("fields.loginEmail")}
          htmlFor="admin-business-email"
          hint={t("lockedHint")}
        >
          <div className="relative">
            <Input
              id="admin-business-email"
              value={form.businessEmail}
              readOnly
              disabled
              className="pr-24"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <LockKeyhole className="size-3" />
              {t("lockedBadge")}
            </span>
          </div>
        </Field>

        <Field
          label={t("fields.supportEmail")}
          htmlFor="admin-support-email"
          error={fieldErrors.supportEmail}
        >
          <Input
            id="admin-support-email"
            type="email"
            value={form.supportEmail}
            onChange={(event) => updateField("supportEmail", event.target.value)}
            placeholder={t("placeholders.supportEmail")}
            maxLength={INPUT_LIMITS.email}
            aria-invalid={!!fieldErrors.supportEmail}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("fields.businessPhone")}
          htmlFor="admin-business-phone"
          hint={t("placeholders.phoneHint")}
          error={fieldErrors.businessPhone}
        >
          <PhoneInput
            id="admin-business-phone"
            value={form.businessPhone}
            onChange={(value) => updateField("businessPhone", value)}
            maxLength={INPUT_LIMITS.phone}
          />
        </Field>

        <Field
          label={t("fields.vatNumber")}
          htmlFor="admin-vat-number"
          error={fieldErrors.vatNumber}
        >
          <Input
            id="admin-vat-number"
            value={form.vatNumber}
            onChange={(event) => updateField("vatNumber", event.target.value)}
            placeholder={t("placeholders.vatNumber")}
            maxLength={INPUT_LIMITS.vatNumber}
            aria-invalid={!!fieldErrors.vatNumber}
          />
        </Field>
      </div>

      <Field
        label={t("fields.preferredLocale")}
        htmlFor="admin-preferred-locale"
        hint={t("localeHint")}
      >
        <div id="admin-preferred-locale" className="flex flex-wrap gap-2">
          {(["en", "fr"] as const).map((localeCode) => {
            const isActive = form.preferredLocale === localeCode

            return (
              <button
                key={localeCode}
                type="button"
                onClick={() => updateField("preferredLocale", localeCode)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-(--contrazy-teal) bg-(--contrazy-teal)/8 text-foreground"
                    : "border-border/70 bg-background hover:border-(--contrazy-teal)/40 hover:bg-muted/40"
                )}
              >
                <Globe className="size-4" />
                {t(`localeOptions.${localeCode}`)}
              </button>
            )
          })}
        </div>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("fields.country")}
          htmlFor="admin-business-country"
          error={fieldErrors.businessCountry}
        >
          <CountryCombobox
            id="admin-business-country"
            value={form.businessCountry}
            onChange={(value) => updateField("businessCountry", value)}
            placeholder={t("placeholders.country")}
          />
        </Field>

        <Field
          label={t("fields.businessAddress")}
          htmlFor="admin-business-address"
          error={fieldErrors.businessAddress}
        >
          <Textarea
            id="admin-business-address"
            className="min-h-28"
            value={form.businessAddress}
            onChange={(event) => updateField("businessAddress", event.target.value)}
            placeholder={t("placeholders.businessAddress")}
            maxLength={INPUT_LIMITS.address}
            aria-invalid={!!fieldErrors.businessAddress}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
          {t("actions.cancel")}
        </Button>
        <Button
          type="submit"
          className="gap-2 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("actions.saving")}
            </>
          ) : (
            t("actions.save")
          )}
        </Button>
      </div>
    </form>
  )
}
