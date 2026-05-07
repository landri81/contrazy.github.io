import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.statusPage" })

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function StatusPage() {
  const t = await getTranslations("marketing.statusPage")
  const cards = t.raw("cards") as Array<{ title: string; description: string; tag: string }>

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <div key={card.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--contrazy-teal)] uppercase">
                {card.tag}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{card.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  )
}
