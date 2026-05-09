"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { FadeIn } from "@/components/ui/motion"

export function CtaSection() {
  const t = useTranslations("marketing.cta")

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#081826,#0f2a3f)] px-5 py-24 text-center text-white lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.14),transparent_55%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),transparent_50%)]" />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute right-[8%] top-[-120px] size-[340px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(17,201,176,.12), transparent 70%)",
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] bottom-[-140px] size-[320px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,.10), transparent 70%)",
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <FadeIn className="relative mx-auto max-w-2xl">
        <h2 className="font-heading text-[34px] font-bold leading-[1.15] tracking-[-0.04em] text-white sm:text-[44px]">
          {t("title")}
        </h2>

        <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-[1.8] text-white/60">
          {t("description")}
        </p>

        <div className="mt-9 flex justify-center">
          <Link
            href="/register"
            className={buttonVariants({
              className:
                "group h-12 rounded-full bg-[var(--contrazy-teal)] px-7 text-white shadow-lg shadow-[rgba(17,201,176,0.18)] transition-all hover:bg-[#0eb8a0] hover:shadow-[rgba(17,201,176,0.28)]",
            })}
          >
            {t("cta")}
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </FadeIn>
    </section>
  )
}