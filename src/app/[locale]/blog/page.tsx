import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PublicShell } from "@/features/marketing/components/public-shell"
import { BlogIndexPage } from "@/features/blog/components/blog-index-page"
import { getPublicBlogPosts } from "@/features/blog/server/blog-data"
import { normalizeLocale } from "@/lib/i18n/locale-utils"
import { resolvePagination } from "@/lib/pagination"
import type { LocaleCode } from "@prisma/client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: "marketing.blogPage" })
  return { title: t("metaTitle"), description: t("metaDescription") }
}

const PAGE_SIZE = 9

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale) as LocaleCode
  const { page: pageParam, q } = await searchParams

  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getPublicBlogPosts(locale, pagination.page, PAGE_SIZE, q || undefined)

  const featuredPost = data.items.find((p) => p.featured) ?? data.items[0] ?? null

  return (
    <PublicShell>
      <Suspense>
        <BlogIndexPage posts={data.items} featuredPost={featuredPost} meta={data.meta} />
      </Suspense>
    </PublicShell>
  )
}
