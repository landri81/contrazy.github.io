import { getTranslations } from "next-intl/server"

import { ChargePayForm } from "@/features/card-security/components/charge-pay-form"
import { consentTextFor } from "@/features/card-security/server/card-security"
import { loadChargeLink } from "@/features/card-security/server/charge-link"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export const dynamic = "force-dynamic"

type ChargeTypeKey = "damage" | "fuel" | "toll" | "towing" | "fps" | "ticket_admin_fee" | "late_return" | "extra_km" | "cleaning" | "other"

export async function generateMetadata() {
  const t = await getTranslations("chargeLink")
  return { title: t("metaTitle"), robots: { index: false, follow: false } }
}

/**
 * Customer link of a post-rental charge (Spec v2.1 §10): what is charged, by
 * whom and why, then the payment on session or the card update. Shown in the
 * booking's language; the link token is the only key.
 */
export default async function ChargeLinkPage(props: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations("chargeLink")
  const link = await loadChargeLink(token)

  const shell = (children: React.ReactNode, vendorName?: string | null) => (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-lg space-y-5">
        {vendorName ? <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground">{vendorName}</p> : null}
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">{children}</div>
        <p className="text-center text-xs text-muted-foreground">{t("securedByStripe")}</p>
      </div>
    </main>
  )

  if (!link) {
    return shell(
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold">{t("notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("notFoundText")}</p>
      </div>
    )
  }

  const { charge } = link
  const vendor = charge.transaction.vendor
  const amountLabel = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: charge.currency }).format(charge.amount / 100)

  if (link.paid || !link.mode) {
    return shell(
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold">{link.paid ? t("paidTitle") : t("closedTitle")}</h1>
        <p className="text-sm text-muted-foreground">{link.paid ? t("paidText") : t("closedText")}</p>
      </div>,
      vendor.businessName
    )
  }

  let consent: { fr: string; en: string; showTranslation: boolean } | null = null

  if (link.mode === "card_update") {
    const text = consentTextFor({ vendor })
    consent = { fr: text.fr, en: text.en, showTranslation: locale !== "fr" }
  }

  return shell(
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold sm:text-2xl">{link.mode === "card_update" ? t("cardUpdateTitle") : t("payTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro", { vendor: vendor.businessName ?? "" })}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
        <dt className="text-muted-foreground">{t("chargeFor")}</dt>
        <dd className="text-right font-medium">{t(`types.${charge.type.toLowerCase() as ChargeTypeKey}`)}</dd>
        {charge.description ? (
          <>
            <dt className="text-muted-foreground">{t("details")}</dt>
            <dd className="text-right">{charge.description}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t("booking")}</dt>
        <dd className="text-right font-mono text-xs">{charge.transaction.externalRef ?? charge.transaction.reference}</dd>
        <dt className="text-muted-foreground">{t("amount")}</dt>
        <dd className="text-right text-base font-bold">{amountLabel}</dd>
      </dl>

      {charge.proofUrls.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {charge.proofUrls.map((url, index) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-(--contrazy-teal) underline underline-offset-2">
                {t("proof", { n: index + 1 })}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <ChargePayForm token={token} mode={link.mode} amountLabel={amountLabel} consent={consent} />

      <p className="text-xs text-muted-foreground">{t("dispute", { vendor: vendor.businessName ?? "", contact: vendor.supportEmail ?? vendor.businessEmail ?? "" })}</p>
    </div>,
    vendor.businessName
  )
}
