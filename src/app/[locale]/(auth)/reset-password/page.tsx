import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { prisma } from "@/lib/db/prisma"
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
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const { token } = await searchParams
  const tokenState = await resolveResetTokenState(token)
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" })

  return (
    <AuthLayout
      title={tokenState === "valid" ? t("title") : t("invalidTitle")}
      subtitle={tokenState === "valid" ? t("subtitle") : t("invalidSubtitle")}
    >
      <ResetPasswordForm token={token} tokenState={tokenState} />
    </AuthLayout>
  )
}

async function resolveResetTokenState(token: string | undefined) {
  if (!token) {
    return "missing" as const
  }

  const resetRecord = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      expiresAt: { gte: new Date() },
    },
    select: { id: true },
  })

  return resetRecord ? ("valid" as const) : ("invalid" as const)
}
