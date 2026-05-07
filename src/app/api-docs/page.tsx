import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { routing } from "@/i18n/routing"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "marketing.guidePage" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function ApiDocsPage() {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "marketing.guidePage" })
  return (
    <PublicShell>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <ProseSections
        eyebrow={t("sectionsEyebrow")}
        title={t("sectionsTitle")}
        description={t("sectionsDescription")}
        sections={t.raw("sections") as Array<{ title: string; paragraphs: string[]; bullets?: string[] }>}
      />
    </PublicShell>
  )
}
