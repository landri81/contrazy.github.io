"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Globe,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  UserCircle,
  UserRound,
  X,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { CountryCombobox } from "@/components/ui/country-combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatValueLabel } from "@/features/dashboard/lib/format-value-label"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type VendorProfileFormProps = {
  initialValues: {
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
    reviewStatus: string
    stripeConnectionStatus: string
  }
  accountEmail: string
}

function normalizeInitialValues(
  initialValues: VendorProfileFormProps["initialValues"],
  accountEmail: string
) {
  return {
    ...initialValues,
    businessEmail: accountEmail,
  }
}

export function VendorProfileForm({ initialValues, accountEmail }: VendorProfileFormProps) {
  const router = useRouter()
  const t = useTranslations("dashboard.vendor.profileForm")
  const normalizedInitialValues = useMemo(
    () => normalizeInitialValues(initialValues, accountEmail),
    [accountEmail, initialValues]
  )

  const [form, setForm] = useState(normalizedInitialValues)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const ownerDisplayName = [form.ownerFirstName, form.ownerLastName].filter(Boolean).join(" ").trim()

  const profileCompletion = useMemo(() => {
    const requiredValues = [
      form.ownerFirstName,
      form.ownerLastName,
      form.businessName,
      form.businessEmail,
      form.businessPhone,
      form.businessAddress,
      form.businessCountry,
      form.registrationNumber,
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

  function openEditor() {
    setError(null)
    setMessage(null)
    setFieldErrors({})
    setForm(normalizedInitialValues)
    setIsEditing(true)
  }

  function cancelEditor() {
    setError(null)
    setFieldErrors({})
    setForm(normalizedInitialValues)
    setIsEditing(false)
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
      setError(t("messages.fixErrors"))
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/vendor/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parsed.data,
            businessEmail: accountEmail,
          }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? t("messages.saveError"))
          return
        }

        setMessage(t("messages.success"))
        setIsEditing(false)
        router.refresh()
      } catch (requestError) {
        console.error(requestError)
        setError(t("messages.networkError"))
      }
    })
  }

  const reviewStatusLabel = formatValueLabel(form.reviewStatus)
  const stripeStatusLabel = formatValueLabel(form.stripeConnectionStatus)

  return (
    <div className="space-y-4">
      <ProfileOverview
        businessName={form.businessName}
        fullName={ownerDisplayName}
        profileCompletion={profileCompletion}
        reviewStatus={reviewStatusLabel}
        stripeConnectionStatus={stripeStatusLabel}
        isEditing={isEditing}
        isPending={isPending}
        onEdit={openEditor}
        onClose={cancelEditor}
      />

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </motion.div>
        ) : message ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.form
            key="edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
            onSubmit={handleSubmit}
          >
            <InfoSection
              title={t("editTitle")}
              description={t("editDescription")}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("fields.firstName")} htmlFor="ownerFirstName" error={fieldErrors.ownerFirstName}>
                  <Input
                    id="ownerFirstName"
                    autoComplete="given-name"
                    placeholder={t("placeholders.firstName")}
                    maxLength={INPUT_LIMITS.personName}
                    value={form.ownerFirstName}
                    onChange={(event) => updateField("ownerFirstName", event.target.value)}
                    aria-invalid={!!fieldErrors.ownerFirstName}
                  />
                </Field>

                <Field label={t("fields.lastName")} htmlFor="ownerLastName" error={fieldErrors.ownerLastName}>
                  <Input
                    id="ownerLastName"
                    autoComplete="family-name"
                    placeholder={t("placeholders.lastName")}
                    maxLength={INPUT_LIMITS.personName}
                    value={form.ownerLastName}
                    onChange={(event) => updateField("ownerLastName", event.target.value)}
                    aria-invalid={!!fieldErrors.ownerLastName}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("fields.businessName")} htmlFor="businessName" error={fieldErrors.businessName}>
                  <Input
                    id="businessName"
                    placeholder={t("placeholders.businessName")}
                    maxLength={INPUT_LIMITS.businessName}
                    value={form.businessName}
                    onChange={(event) => updateField("businessName", event.target.value)}
                    aria-invalid={!!fieldErrors.businessName}
                  />
                </Field>

                <Field label={t("fields.registrationNumber")} htmlFor="registrationNumber" error={fieldErrors.registrationNumber}>
                  <Input
                    id="registrationNumber"
                    placeholder={t("placeholders.registrationNumber")}
                    maxLength={INPUT_LIMITS.registrationNumber}
                    value={form.registrationNumber}
                    onChange={(event) => updateField("registrationNumber", event.target.value)}
                    aria-invalid={!!fieldErrors.registrationNumber}
                  />
                </Field>
              </div>

              <LockedField
                label={t("fields.loginEmail")}
                value={accountEmail}
                hint={t("lockedHint")}
                badge={t("lockedBadge")}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("fields.supportEmail")} htmlFor="supportEmail" error={fieldErrors.supportEmail}>
                  <Input
                    id="supportEmail"
                    type="email"
                    autoComplete="email"
                    placeholder={t("placeholders.supportEmail")}
                    maxLength={INPUT_LIMITS.email}
                    value={form.supportEmail}
                    onChange={(event) => updateField("supportEmail", event.target.value)}
                    aria-invalid={!!fieldErrors.supportEmail}
                  />
                </Field>

                <Field
                  label={t("fields.businessPhone")}
                  htmlFor="businessPhone"
                  error={fieldErrors.businessPhone}
                  hint={t("placeholders.phoneHint")}
                >
                  <PhoneInput
                    id="businessPhone"
                    value={form.businessPhone}
                    onChange={(value) => updateField("businessPhone", value)}
                    maxLength={INPUT_LIMITS.phone}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("fields.vatNumber")} htmlFor="vatNumber" error={fieldErrors.vatNumber}>
                  <Input
                    id="vatNumber"
                    placeholder={t("placeholders.vatNumber")}
                    maxLength={INPUT_LIMITS.vatNumber}
                    value={form.vatNumber}
                    onChange={(event) => updateField("vatNumber", event.target.value)}
                    aria-invalid={!!fieldErrors.vatNumber}
                  />
                </Field>
              </div>

              <Field
                label={t("fields.preferredLocale")}
                htmlFor="preferredLocale"
                hint={t("localeHint")}
              >
                <div id="preferredLocale" className="flex flex-wrap gap-2">
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
                <Field label={t("fields.country")} htmlFor="businessCountry" error={fieldErrors.businessCountry}>
                  <CountryCombobox
                    id="businessCountry"
                    value={form.businessCountry}
                    onChange={(value) => updateField("businessCountry", value)}
                    placeholder={t("placeholders.country")}
                  />
                </Field>

                <Field label={t("fields.businessAddress")} htmlFor="businessAddress" error={fieldErrors.businessAddress}>
                  <Textarea
                    id="businessAddress"
                    className="min-h-28"
                    placeholder={t("placeholders.businessAddress")}
                    maxLength={INPUT_LIMITS.address}
                    value={form.businessAddress}
                    onChange={(event) => updateField("businessAddress", event.target.value)}
                    aria-invalid={!!fieldErrors.businessAddress}
                  />
                </Field>
              </div>
            </InfoSection>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelEditor} disabled={isPending}>
                <X className="size-4" />
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
                  <>
                    <Save className="size-4" />
                    {t("actions.save")}
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <InfoSection
              title={t("contactTitle")}
              description={t("contactDescription")}
            >
              <DisplayField
                icon={UserCircle}
                label={t("display.accountOwner")}
                value={ownerDisplayName}
                emptyLabel={t("display.emptyOwner")}
              />
              <DisplayField
                icon={Mail}
                label={t("fields.loginEmail")}
                value={accountEmail}
                hint={t("display.loginEmailHint")}
                badge={t("lockedBadge")}
              />
              <DisplayField
                icon={Mail}
                label={t("fields.supportEmail")}
                value={form.supportEmail}
                emptyLabel={t("display.emptySupportEmail")}
              />
              <DisplayField
                icon={Globe}
                label={t("fields.preferredLocale")}
                value={t(`localeOptions.${form.preferredLocale}`)}
              />
              <DisplayField
                icon={Phone}
                label={t("fields.businessPhone")}
                value={form.businessPhone}
                emptyLabel={t("display.emptyPhone")}
              />
            </InfoSection>

            <InfoSection
              title={t("businessTitle")}
              description={t("businessDescription")}
            >
              <DisplayField
                icon={Building2}
                label={t("fields.businessName")}
                value={form.businessName}
                emptyLabel={t("display.emptyBusinessName")}
              />
              <DisplayField
                icon={Building2}
                label={t("fields.registrationNumber")}
                value={form.registrationNumber}
                emptyLabel={t("display.emptyRegistration")}
              />
              <DisplayField
                icon={Building2}
                label={t("fields.vatNumber")}
                value={form.vatNumber}
                emptyLabel={t("display.emptyVat")}
              />
              <DisplayField
                icon={Globe}
                label={t("fields.country")}
                value={form.businessCountry}
                emptyLabel={t("display.emptyCountry")}
              />
              <DisplayField
                icon={MapPin}
                label={t("fields.businessAddress")}
                value={form.businessAddress}
                emptyLabel={t("display.emptyAddress")}
                multiline
              />
            </InfoSection>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProfileOverview({
  businessName,
  fullName,
  profileCompletion,
  reviewStatus,
  stripeConnectionStatus,
  isEditing,
  isPending,
  onEdit,
  onClose,
}: {
  businessName: string
  fullName: string
  profileCompletion: number
  reviewStatus: string
  stripeConnectionStatus: string
  isEditing: boolean
  isPending: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const t = useTranslations("dashboard.vendor.profileForm")

  const stats = [
    {
      label: t("stats.profile"),
      value: `${profileCompletion}%`,
      icon: UserRound,
      tone: profileCompletion === 100 ? "success" : "info",
    },
    {
      label: t("stats.review"),
      value: reviewStatus,
      icon: ShieldCheck,
      tone: statusTone(reviewStatus),
    },
    {
      label: t("stats.payout"),
      value: stripeConnectionStatus,
      icon: CreditCard,
      tone: statusTone(stripeConnectionStatus),
    },
  ]

  const toneClassMap: Record<string, string> = {
    success: "border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]",
    info: "border-border bg-muted text-muted-foreground",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400",
    danger: "border-destructive/25 bg-destructive/5 text-destructive",
    error: "border-destructive/25 bg-destructive/5 text-destructive",
    muted: "border-border bg-muted text-muted-foreground",
    default: "border-border bg-muted text-muted-foreground",
  }

  return (
    <section className="border rounded-xl border-border bg-background text-foreground">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="size-3.5 text-[var(--contrazy-teal)]" />
              {t("overview.tag")}
            </div>

            <h2 className="mt-3 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {businessName.trim() || t("overview.defaultName")}
            </h2>

            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">
                  {fullName.trim() || t("display.emptyOwner")}
                </span>
              </span>
              <span className="text-border">/</span>
              <span>{t("overview.workspaceHint")}</span>
            </div>
          </div>

          <Button
            type="button"
            variant={isEditing ? "outline" : "default"}
            className={cn(
              "h-9 cursor-pointer rounded-sm shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0 sm:self-start",
              isEditing
                ? "border-border bg-background text-foreground hover:bg-muted"
                : "bg-[var(--contrazy-navy)] text-white hover:opacity-90"
            )}
            onClick={isEditing ? onClose : onEdit}
            disabled={isPending}
          >
            {isEditing ? (
              <X className="mr-1.5 size-4" />
            ) : (
              <PencilLine className="mr-1.5 size-4" />
            )}
            {isEditing ? t("overview.closeEditButton") : t("overview.editButton")}
          </Button>
        </div>
      </div>

      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((item) => {
          const Icon = item.icon
          const toneClass = toneClassMap[item.tone] ?? toneClassMap.default

          return (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-sm border",
                  toneClass
                )}
              >
                <Icon className="size-4" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {item.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InfoSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/80 bg-background p-4 shadow-sm">
      <div className="pb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function LockedField({
  label,
  value,
  hint,
  badge,
}: {
  label: string
  value: string
  hint: string
  badge: string
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <LockKeyhole className="size-3" />
          {badge}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function DisplayField({
  icon: Icon,
  label,
  value,
  emptyLabel,
  hint,
  badge,
  multiline,
}: {
  icon: React.ElementType
  label: string
  value: string
  emptyLabel?: string
  hint?: string
  badge?: string
  multiline?: boolean
}) {
  const hasValue = value.trim().length > 0

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/15 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
          <Icon className="size-4 text-[var(--contrazy-teal)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            {badge ? (
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 text-sm font-medium text-foreground",
              !hasValue && "text-muted-foreground",
              multiline && "whitespace-pre-wrap break-words"
            )}
          >
            {hasValue ? value : emptyLabel ?? "—"}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  )
}

function CompactStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "warning" | "danger" | "info" | "neutral"
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }

  return (
    <div className={cn("rounded-2xl border px-3 py-3", toneClasses[tone])}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold sm:text-base">{value}</p>
    </div>
  )
}

function statusTone(value: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const normalized = value.toLowerCase()

  if (normalized.includes("approved") || normalized.includes("connected") || normalized.includes("complete")) {
    return "success"
  }

  if (normalized.includes("pending")) {
    return "warning"
  }

  if (normalized.includes("error") || normalized.includes("rejected") || normalized.includes("suspended")) {
    return "danger"
  }

  if (normalized.includes("not connected")) {
    return "neutral"
  }

  return "info"
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
