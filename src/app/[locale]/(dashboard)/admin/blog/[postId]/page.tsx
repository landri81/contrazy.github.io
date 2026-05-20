import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { BlogPostEditor } from "@/features/blog/components/blog-post-editor"
import { getAdminBlogPost } from "@/features/blog/server/blog-data"
import { requireSuperAdminAccess } from "@/lib/auth/guards"
import { Link } from "@/i18n/navigation"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>
}): Promise<Metadata> {
  const { postId } = await params
  const post = await getAdminBlogPost(postId)
  const enLocale = post?.locales.find((l) => l.locale === "en")
  return { title: enLocale?.title ? `Edit: ${enLocale.title}` : "Edit post" }
}

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  await requireSuperAdminAccess()
  const { postId } = await params
  const post = await getAdminBlogPost(postId)
  if (!post) notFound()

  const primaryLocale = post.locales.find((l) => l.locale === "en") ?? post.locales[0]

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link
          href="/admin/blog"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to blog
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm font-medium line-clamp-1">{primaryLocale?.title ?? "Edit post"}</span>
      </div>

      <BlogPostEditor
        mode="edit"
        postId={post.id}
        initialLocale={primaryLocale?.locale ?? "en"}
        initialTitle={primaryLocale?.title ?? ""}
        initialSlug={primaryLocale?.slug ?? ""}
        initialExcerpt={primaryLocale?.excerpt ?? ""}
        initialContent={primaryLocale?.content as object | null}
        initialContentHtml={primaryLocale?.contentHtml ?? ""}
        initialCategory={primaryLocale?.category ?? ""}
        initialTags={primaryLocale?.tags ?? []}
        initialSeoTitle={primaryLocale?.seoTitle ?? ""}
        initialSeoDesc={primaryLocale?.seoDesc ?? ""}
        initialCoverAlt={primaryLocale?.coverAlt ?? ""}
        initialCoverUrl={post.coverUrl}
        initialCoverPublicId={post.coverPublicId}
        initialStatus={post.status}
        initialFeatured={post.featured}
      />
    </div>
  )
}
