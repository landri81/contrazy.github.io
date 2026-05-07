"use client"

import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { usePathname, useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
] as const

type LocaleCode = (typeof LOCALES)[number]["code"]

type LocaleSwitcherVariant = "dark" | "light"

type LocaleSwitcherProps = {
  className?: string
  variant?: LocaleSwitcherVariant
}

export function LocaleSwitcher({ className, variant = "dark" }: LocaleSwitcherProps) {
  const t = useTranslations("common")
  const locale = useLocale() as LocaleCode
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeIndex = LOCALES.findIndex((item) => item.code === locale)

  function switchLocale(nextLocale: LocaleCode) {
    if (nextLocale === locale || isPending) return

    const query = searchParams.toString()

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        locale: nextLocale,
      })
    })
  }

  const isDark = variant === "dark"

  return (
    <div
      className={cn(
        "relative inline-flex h-9 w-fit items-center rounded-full p-1 shadow-sm",
        "transition-all duration-300",
        isDark
          ? "border border-white/10 bg-white/8 backdrop-blur-md hover:border-white/20 hover:bg-white/10"
          : "border border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-150",
        isPending && "pointer-events-none opacity-70",
        className
      )}
      aria-label={t("languageSwitcher")}
    >
      <span
        className={cn(
          "absolute left-1 top-1 h-7 w-10 rounded-full shadow-sm",
          "transition-transform duration-300 ease-out",
          isDark ? "bg-white" : "bg-white shadow-slate-200/80"
        )}
        style={{
          transform: `translateX(${activeIndex * 2.5}rem)`,
        }}
      />

      {LOCALES.map(({ code, label }) => {
        const isActive = locale === code

        return (
          <button
            key={code}
            type="button"
            disabled={isPending}
            onClick={() => switchLocale(code)}
            aria-pressed={isActive}
            className={cn(
              "relative cursor-pointer z-10 flex h-7 w-10 items-center justify-center rounded-full",
              "text-xs font-bold uppercase tracking-wide",
              "transition-colors duration-300",
              isDark
                ? cn(
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    isActive ? "text-slate-950" : "text-white/60 hover:text-white"
                  )
                : cn(
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                  )
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}