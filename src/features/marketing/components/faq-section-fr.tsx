"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function FaqSectionFr() {
  const t = useTranslations("marketing.faq")
  const faqItems = t.raw("items") as Array<{ q: string; a: string }>
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  return (
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

        {/* Accordion */}
        <div className="max-w-3xl space-y-2">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <motion.div
                key={item.q}
                layout
                className="cursor-pointer overflow-hidden rounded-[12px] border bg-background"
                initial={false}
                animate={{
                  borderColor: isOpen ? "rgba(17,201,176,0.38)" : "rgba(15,23,42,0.08)",
                  boxShadow: isOpen
                    ? "0 20px 44px rgba(15, 23, 42, 0.08)"
                    : "0 10px 24px rgba(15, 23, 42, 0.04)",
                  y: isOpen ? -2 : 0,
                }}
                whileHover={{
                  borderColor: "rgba(17,201,176,0.26)",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                  y: -2,
                }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => setOpenIndex(index)}
                onMouseLeave={() => setOpenIndex((current) => (current === index ? null : current))}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between px-6 py-[18px] text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contrazy-teal)]/35 focus-visible:ring-offset-2"
                  onClick={() => toggleItem(index)}
                  onFocus={() => setOpenIndex(index)}
                >
                  <span
                    className={`text-[15px] font-semibold transition-colors ${
                      isOpen ? "text-[var(--contrazy-teal)]" : "text-foreground"
                    }`}
                  >
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className={`ml-4 shrink-0 cursor-pointer transition-colors ${
                      isOpen ? "text-[var(--contrazy-teal)]" : "text-muted-foreground"
                    }`}
                  >
                    <ChevronDown className="size-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-[14px] leading-[1.75] text-muted-foreground">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
