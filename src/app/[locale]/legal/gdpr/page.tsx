import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.legal.gdpr" })
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function GdprPage() {
  const t = await getTranslations("marketing.legal.gdpr")
  return (
    <PublicShell>
      <ProseSections
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        sections={t.raw("sections") as Array<{ title: string; paragraphs: string[]; bullets?: string[] }>}
      />
    </PublicShell>
  )
}
