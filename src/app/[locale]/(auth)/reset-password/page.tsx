import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" })
  return { title: t("metaTitle") }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const t = await getTranslations("auth.resetPassword")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <ResetPasswordForm token={token} />
    </AuthLayout>
  )
}
