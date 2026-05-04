import { getAuthSession } from "@/lib/auth/session"
import { LandingPage } from "@/features/marketing/components/landing-page"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Contrazy",
      alternateName: "Conntrazy",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo/icon-contrazy-512.png`,
        width: 512,
        height: 512,
      },
      image: `${siteUrl}/logo/logo-contrazy-dark.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Contrazy",
      alternateName: "Conntrazy",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      inLanguage: "en",
    },
  ],
}

export default async function HomePage() {
  const session = await getAuthSession()

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage viewerRole={session?.user?.role ?? null} />
    </PublicShell>
  )
}
