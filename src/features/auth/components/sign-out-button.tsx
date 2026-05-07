"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const locale = useLocale()
  const t = useTranslations("site.header")
  return (
    <Button
      variant="ghost"
      size="sm"
      className="border border-white/12 bg-white/6 px-3 text-white hover:bg-white/10 hover:text-white"
      onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
    >
      <LogOut className="size-3.5" />
      <span>{t("signOut")}</span>
    </Button>
  )
}
