import type { MetadataRoute } from "next"

import { getPublishedBlogSlugs } from "@/features/blog/server/blog-data"
import { routing } from "@/i18n/routing"
import { getSiteUrl } from "@/lib/site-url"

const STATIC_PATHS = [
  "",
  "/blog",
  "/pricing",
  "/faq",
  "/contact",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const slugs = await getPublishedBlogSlugs().catch(() => [])

  const staticEntries: MetadataRoute.Sitemap = routing.locales.flatMap((locale) =>
    STATIC_PATHS.map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1.0 : 0.8,
    }))
  )

  const blogEntries: MetadataRoute.Sitemap = slugs.map(({ locale, slug }) => ({
    url: `${siteUrl}/${locale}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...blogEntries]
}
