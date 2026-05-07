import type { Metadata, Viewport } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { AppProviders } from "@/app/providers"
import { routing } from "@/i18n/routing"
import { normalizeLocale } from "@/lib/i18n/locale-utils"
import { getSiteUrl } from "@/lib/site-url"
import "@/app/globals.css"
import "quill/dist/quill.snow.css"

type LocaleLayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const siteUrl = getSiteUrl()
  const t = await getTranslations({ locale, namespace: "site" })

  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("name"), template: `%s | ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
        { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      ],
      shortcut: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
      apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}/${locale}`,
      siteName: t("name"),
      title: t("name"),
      description: t("tagline"),
      images: [{ url: "/favicon.ico", alt: t("name") }],
    },
    twitter: {
      card: "summary",
      title: t("name"),
      description: t("tagline"),
      images: ["/favicon.ico"],
    },
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
  }
}

export const viewport: Viewport = {
  themeColor: "#0c1e2f",
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params

  if (!(routing.locales as readonly string[]).includes(rawLocale)) {
    notFound()
  }

  const locale = normalizeLocale(rawLocale)
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
