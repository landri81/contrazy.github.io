import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ChevronLeft } from "lucide-react"

import { BlogPostEditor } from "@/features/blog/components/blog-post-editor"
import { requireSuperAdminAccess } from "@/lib/auth/guards"
import { Link } from "@/i18n/navigation"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.admin.blog")
  return { title: `${t("newPost")} — Blog Admin` }
}

export default async function AdminBlogNewPage() {
  await requireSuperAdminAccess()

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
        <span className="text-sm font-medium">New post</span>
      </div>

      <BlogPostEditor mode="create" />
    </div>
  )
}
