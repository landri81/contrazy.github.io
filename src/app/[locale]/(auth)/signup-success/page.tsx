import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CircleCheckBig } from "lucide-react"
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
  const t = await getTranslations({ locale, namespace: "auth.signupSuccess" })
  return { title: t("metaTitle") }
}

export default async function SignupSuccessPage() {
  const t = await getTranslations("auth.signupSuccess")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <CircleCheckBig className="mx-auto size-10 text-emerald-600" />
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {t("subtitle")}
        </p>
        <Link
          href="/login"
          className={buttonVariants({
            className: "mt-5 h-10 bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]",
          })}
        >
          {t("cta")}
        </Link>
      </div>
    </AuthLayout>
  )
}
