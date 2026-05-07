import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"
import { normalizeLocale } from "@/lib/i18n/locale-utils"
import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"
import { withLocalePath } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "auth.login" })
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const session = await getAuthSession()

  if (session?.user?.role) {
    redirect(withLocalePath(locale, getRoleHomePath(session.user.role)))
  }

  const t = await getTranslations("auth.login")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <LoginForm />
    </AuthLayout>
  )
}
