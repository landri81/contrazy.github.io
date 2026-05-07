import type { Metadata } from "next"
import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { PublicShell } from "@/features/marketing/components/public-shell"
import { blogFeaturedArtwork, blogPostArtwork } from "@/features/marketing/section-artwork"
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
            <div className="relative min-h-[300px] overflow-hidden border-b border-border bg-linear-to-br from-[#eefaf7] via-white to-[#eff6ff] sm:border-b-0 sm:border-r">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.16),transparent_58%)]" />
              <div className="absolute inset-0 p-6 sm:p-8">
                <div className="relative h-full overflow-hidden rounded-[18px] border border-white/80 bg-white/70 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                  <Image
                    src={blogFeaturedArtwork}
                    alt={featuredPost.title}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-contain p-5 transition-transform duration-300 hover:scale-[1.03]"
                    priority
                  />
                </div>
              </div>
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
            {blogPosts.map((post, i) => (
              <article
                key={post.title}
                className="group cursor-pointer overflow-hidden rounded-[16px] border border-border bg-background transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-[190px] overflow-hidden border-b border-border bg-linear-to-br from-[#eefaf7] via-white to-[#eff6ff] p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.14),transparent_62%)]" />
                  <div className="relative h-full overflow-hidden rounded-[14px] border border-white/80 bg-white/80 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                    <Image
                      src={blogPostArtwork[i] ?? blogPostArtwork[blogPostArtwork.length - 1]}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                      className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
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
