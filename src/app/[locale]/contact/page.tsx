import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ContactSection, PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.contactPage" })

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations("marketing.contactPage")
  const channels = t.raw("channels") as Array<{ title: string; description: string }>

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <ContactSection channels={channels} locale={locale} />
    </PublicShell>
  )
}
