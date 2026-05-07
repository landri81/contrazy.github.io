import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PublicShell } from "@/features/marketing/components/public-shell"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

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

export default async function BlogPage() {
  const t = await getTranslations("marketing.blogPage")
  const featuredPost = t.raw("featuredPost") as Record<string, string>
  const blogPosts = t.raw("posts") as Array<Record<string, string>>
  return (
    <PublicShell>
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

          {/* Featured post */}
          <div className="mb-12 grid cursor-pointer overflow-hidden rounded-[20px] border border-border bg-background transition-all hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-2">
            {/* Image side */}
            <div
              className="flex min-h-[300px] items-center justify-center text-[72px]"
              style={{ background: "linear-gradient(135deg, #0c1e2f, #132d46)" }}
            >
              {featuredPost.emoji}
            </div>
            {/* Content side */}
            <div className="flex flex-col justify-center p-10 sm:p-12">
              <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                {featuredPost.category}
              </p>
              <h2 className="mt-2 text-[22px] font-bold leading-[1.35] text-foreground">
                {featuredPost.title}
              </h2>
              <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
                {featuredPost.excerpt}
              </p>
              <p className="mt-4 text-[12px] text-muted-foreground/70">
                {featuredPost.date} · {featuredPost.readTime}
              </p>
            </div>
          </div>

          {/* Blog grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <article
                key={post.title}
                className="cursor-pointer overflow-hidden rounded-[14px] border border-border bg-background transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Emoji image area */}
                <div className="flex h-[160px] items-center justify-center border-b border-border bg-[var(--contrazy-bg-muted)] text-[44px]">
                  {post.emoji}
                </div>
                {/* Card body */}
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                    {post.category}
                  </p>
                  <h3 className="mt-2 text-[16px] font-bold leading-[1.35] text-foreground">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <p className="mt-3 text-[12px] text-muted-foreground/60">
                    {post.date} · {post.readTime}
                  </p>
                </div>
              </article>
            ))}
          </div>

        </div>
      </div>
    </PublicShell>
  )
}
