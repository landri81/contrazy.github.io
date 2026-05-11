"use client"

import type { UserRole } from "@/lib/auth/roles"
import { useTranslations } from "next-intl"

import { FadeIn } from "@/components/ui/motion"
import { SubscriptionPricingGrid } from "@/features/subscriptions/components/subscription-pricing-grid"
import { ReceiptText } from "lucide-react"

export function PricingSectionFr({ viewerRole = null }: { viewerRole?: UserRole | null }) {
  const t = useTranslations("marketing.pricingSection")

  return (
    <section id="tarifs" className="bg-background px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em> {t("titleAfter")}
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            {t("description")}
          </p>
        </FadeIn>

        <div className="mt-10">
          <SubscriptionPricingGrid mode="marketing" viewerRole={viewerRole} />
        </div>

        {/* Transaction fees note */}
        <FadeIn delay={0.1} className="mt-8">
          <div className="rounded-[14px] border border-border border-l-[3px] border-l-[var(--contrazy-teal)] bg-background p-7">
            <div className="mb-4 flex items-center gap-3">
              <ReceiptText className="size-4 text-[var(--contrazy-teal)]" />
              <h3 className="text-[15px] font-bold text-foreground"> {t("feesTitle")}</h3>
            </div>
            <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
              <strong className="text-foreground">{t("fees.releaseLabel")}</strong> :{" "}
              <span className="font-bold text-green-600">{t("fees.releaseValue")}</span> · {t("fees.releaseDetail")}
              <br />
              <strong className="text-foreground">{t("fees.captureLabel")}</strong> :{" "}
              <span className="font-semibold">{t("fees.captureValue")}</span> {t("fees.captureDetail")}
              <br />
              <strong className="text-foreground">{t("fees.paymentLabel")}</strong> : {t("fees.paymentDetail")}
              <br />
              <strong className="text-foreground">{t("fees.kycLabel")}</strong> : {t("fees.kycDetail")}
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
