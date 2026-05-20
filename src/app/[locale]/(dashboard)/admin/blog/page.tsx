import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AdminBlogList } from "@/features/blog/components/admin-blog-list"
import { getAdminBlogPosts } from "@/features/blog/server/blog-data"
import { requireSuperAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.admin.blog")
  return { title: t("metaTitle") }
}

const PAGE_SIZE = 20

export default async function AdminBlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  await requireSuperAdminAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminBlogPosts(pagination.page, PAGE_SIZE, { q, status })

  return (
    <Suspense>
      <AdminBlogList
        items={data.items}
        meta={data.meta}
        searchParams={compactSearchParams({ q, status })}
      />
    </Suspense>
  )
}
