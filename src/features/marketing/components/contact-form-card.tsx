"use client"

import { Send } from "lucide-react"
import { useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactFormCard() {
  const t = useTranslations("marketing.contactPage")
  const [submitted, setSubmitted] = useState(false)

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
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">{t("formFirstName")}</Label>
              <Input id="first-name" placeholder={t("formFirstNamePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">{t("formLastName")}</Label>
              <Input id="last-name" placeholder={t("formLastNamePlaceholder")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("formEmail")}</Label>
            <Input id="email" type="email" placeholder={t("formEmailPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t("formMessage")}</Label>
            <Textarea
              id="message"
              className="min-h-32"
              placeholder={t("formMessagePlaceholder")}
            />
          </div>
          <Button type="submit" className="h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]">
            <Send className="size-4" />
            {t("formSubmit")}
          </Button>
        </form>
      )}
    </div>
  )
}
