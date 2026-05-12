"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { ListChecks, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useSubmissionLock } from "@/features/client-flow/hooks/use-submission-lock"
import { useRouter } from "@/i18n/navigation"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type ClientCustomFieldFormProps = {
  token: string
  fields: Array<{
    id: string
    label: string
    instructions: string | null
    type: string
    selectOptions: unknown
    response?: {
      value: string | null
    } | null
  }>
}

export function ClientCustomFieldsForm({
  token,
  fields,
}: ClientCustomFieldFormProps) {
  const router = useRouter()
  const t = useTranslations("clientFlow.details")
  const submission = useSubmissionLock()
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.id, field.response?.value ?? ""])
      ) as Record<string, string>,
    [fields]
  )

  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [error, setError] = useState<string | null>(null)

  function updateValue(fieldId: string, nextValue: string) {
    setValues((current) => ({
      ...current,
      [fieldId]: nextValue,
    }))
  }

  function validate() {
    for (const field of fields) {
      const value = values[field.id]?.trim() ?? ""

      if (!value) {
        return t("fieldRequired")
      }

      if (field.type === "NUMBER" && !Number.isFinite(Number(value))) {
        return t("numberInvalid")
      }

      if (field.type === "SELECT") {
        const options = parseTransactionCustomFieldSelectOptions(field.selectOptions)

        if (!options.includes(value)) {
          return t("selectInvalid")
        }
      }
    }

    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    submission.start()

    try {
      const response = await fetch(`/api/client/${token}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: fields.map((field) => ({
            customFieldId: field.id,
            value: values[field.id]?.trim() ?? "",
          })),
        }),
      })

      if (response.ok) {
        const payload = await response.json()
        submission.keepLocked()
        router.push(`/t/${token}/${payload.nextStep ?? "contract"}`)
        return
      }

      if (response.status === 410) {
        submission.keepLocked()
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await response.json().catch(() => null)
      setError(payload?.message ?? t("unableToSave"))
    } catch (submitError) {
      console.error(submitError)
      setError(t("unableToSave"))
    } finally {
      submission.finish()
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
                <CardTitle className="font-heading text-xl font-semibold tracking-tight">
                  {t("cardTitle")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t("cardDescription")}
                </CardDescription>
              </div>
              <div className="hidden size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 sm:flex">
                <ListChecks className="size-5" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-5 sm:px-6">
            <AnimatePresence initial={false}>
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {fields.map((field) => {
              const selectOptions = parseTransactionCustomFieldSelectOptions(field.selectOptions)

              return (
                <div key={field.id} className="grid gap-2">
                  <Label
                    htmlFor={`custom-field-${field.id}`}
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                  >
                    {field.label} <span className="text-destructive">*</span>
                  </Label>

                  {field.instructions?.trim() ? (
                    <p className="text-sm text-muted-foreground">{field.instructions}</p>
                  ) : null}

                  {field.type === "SELECT" ? (
                    <Select
                      value={values[field.id] ?? ""}
                      onValueChange={(value) => updateValue(field.id, value ?? "")}
                    >
                      <SelectTrigger
                        id={`custom-field-${field.id}`}
                        className="h-11 rounded-lg border-slate-200 bg-slate-50/60 shadow-none focus-visible:bg-white"
                      >
                        <span className="truncate text-left">
                          {values[field.id]?.trim() || t("selectPlaceholder")}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {selectOptions.map((option) => (
                          <SelectItem key={option} value={option} className="cursor-pointer">
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`custom-field-${field.id}`}
                      type={field.type === "NUMBER" ? "number" : "text"}
                      step={field.type === "NUMBER" ? "any" : undefined}
                      maxLength={INPUT_LIMITS.transactionCustomFieldValue}
                      className="h-11 rounded-lg border-slate-200 bg-slate-50/60 shadow-none focus-visible:bg-white"
                      placeholder={
                        field.type === "NUMBER"
                          ? t("numberPlaceholder")
                          : t("textPlaceholder")
                      }
                      value={values[field.id] ?? ""}
                      onChange={(event) => updateValue(field.id, event.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>

          <CardFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
              disabled={submission.isLocked}
            >
              {submission.isLocked ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {submission.isLocked ? t("saving") : t("continue")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
