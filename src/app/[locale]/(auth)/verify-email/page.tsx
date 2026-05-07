import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"

import { buttonVariants } from "@/components/ui/button"
import { AuthLayout } from "@/features/auth/components/auth-layout"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail" })
  return { title: t("metaTitle") }
}

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <p>{t("subtitle")}</p>
        <Link
          href="/login"
          className={buttonVariants({
            className: "mt-5 h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
          })}
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthLayout>
  )
}
