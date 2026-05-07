import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.helpPage" })
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function HelpPage() {
  const t = await getTranslations("marketing.helpPage")
  const steps = t.raw("steps") as string[]
  return (
    <PublicShell>
      <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">

          {/* Page header */}
          <div className="mb-12 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
            <h1 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
              {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
            </h1>
            <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
              {t("description")}
            </p>
          </div>

          {/* Content */}
          <div className="max-w-[800px] space-y-10">

            <div>
              <h2 className="text-[20px] font-bold leading-snug text-foreground">{t("gettingStartedTitle")}</h2>
              <ol className="mt-5 space-y-3">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--contrazy-teal)]/10 text-[12px] font-bold text-[var(--contrazy-teal)]">
                      {i + 1}
                    </span>
                    <p className="text-[15px] leading-[1.7] text-muted-foreground">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[14px] border border-border bg-background p-7">
              <h2 className="text-[20px] font-bold leading-snug text-foreground">
                {t("extraHelpTitle")}
              </h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
                {t("extraHelpBefore")}{" "}
                <Link
                  href="mailto:support@contrazy.com"
                  className="font-semibold text-[var(--contrazy-teal)] hover:underline"
                >
                  support@contrazy.com
                </Link>{" "}
                {t("extraHelpAfter")}
              </p>
            </div>

          </div>
        </div>
      </div>
    </PublicShell>
  )
}
