"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

import { footerGroupDefs } from "@/content/site"

export function SiteFooter() {
  const t = useTranslations("site")

  return (
    <motion.footer
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-border bg-background"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-15 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <Link href="/" className="text-[22px] font-extrabold tracking-tight text-foreground">
            C<span className="text-[var(--contrazy-teal)]">on</span>trazy
          </Link>
          <p className="mt-3.5 max-w-70 text-[14px] leading-[1.7] text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>

        {footerGroupDefs.map((group) => (
          <div key={group.titleKey}>
            <h4 className="text-[13px] font-bold text-foreground">
              {t(group.titleKey as Parameters<typeof t>[0])}
            </h4>
            <ul className="mt-3.5 space-y-0.75">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-0.75 text-[13px] text-muted-foreground transition-colors hover:text-(--contrazy-teal)"
                  >
                    {t(link.labelKey as Parameters<typeof t>[0])}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl border-t border-border px-5 pb-10 pt-6 lg:px-10">
        <p className="text-center text-[12px] leading-[1.8] text-muted-foreground/70">
          {t("footer.copyright")}
          <br />
          {t("footer.noFunds")}
        </p>
      </div>
    </motion.footer>
  )
}
