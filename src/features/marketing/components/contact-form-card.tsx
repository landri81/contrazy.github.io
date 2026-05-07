"use client"

import { Send } from "lucide-react"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactFormCard({ locale }: { locale?: string }) {
  const t = useTranslations("marketing.contactPage")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = event.currentTarget
    const data = new FormData(form)

    const body = {
      firstName: data.get("firstName") as string,
      lastName: data.get("lastName") as string,
      email: data.get("email") as string,
      message: data.get("message") as string,
      locale: locale ?? "en",
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        const json = await res.json() as { success: boolean; message?: string }

        if (json.success) {
          setSubmitted(true)
        } else {
          setError(json.message ?? t("formErrorGeneric"))
        }
      } catch {
        setError(t("formErrorGeneric"))
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
      {submitted ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t("formSuccessTitle")}</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {t("formSuccessDesc")}
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("formFirstName")}</Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder={t("formFirstNamePlaceholder")}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("formLastName")}</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder={t("formLastNamePlaceholder")}
                required
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("formEmail")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("formEmailPlaceholder")}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t("formMessage")}</Label>
            <Textarea
              id="message"
              name="message"
              className="min-h-32"
              placeholder={t("formMessagePlaceholder")}
              required
              disabled={isPending}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            disabled={isPending}
            className="h-10 bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
          >
            <Send className="size-4" />
            {isPending ? t("formSubmitting") : t("formSubmit")}
          </Button>
        </form>
      )}
    </div>
  )
}
