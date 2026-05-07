import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PricingSectionFr } from "@/features/marketing/components/sections/pricing-section-fr"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { resolveMarketingPlanHref } from "@/features/subscriptions/config"
import { getAuthSession } from "@/lib/auth/session"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.pricingPage" })

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function PricingPage() {
  const session = await getAuthSession()
  const viewerRole = session?.user?.role ?? null
  const t = await getTranslations("marketing.pricingPage")

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        primaryHref={resolveMarketingPlanHref(viewerRole, "pro")}
        primaryLabel={t("primaryLabel")}
      />
      <PricingSectionFr viewerRole={viewerRole} />
      <ProseSections
        eyebrow={t("modelEyebrow")}
        title={t("modelTitle")}
        description={t("modelDescription")}
        sections={t.raw("modelSections") as Array<{ title: string; paragraphs: string[]; bullets?: string[] }>}
      />
    </PublicShell>
  )
}
