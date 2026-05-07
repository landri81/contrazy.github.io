import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "auth.forgotPassword" })
  return { title: t("metaTitle") }
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
