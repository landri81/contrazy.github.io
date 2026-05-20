import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Image from "next/image"
import sanitizeHtml from "sanitize-html"
import { getTranslations } from "next-intl/server"

import { PublicShell } from "@/features/marketing/components/public-shell"
import { getPublicBlogPost, getSuggestedPosts, getPostAlternateLocales } from "@/features/blog/server/blog-data"
import { normalizeLocale } from "@/lib/i18n/locale-utils"
import { getSiteUrl } from "@/lib/site-url"
import { Link } from "@/i18n/navigation"
import type { LocaleCode } from "@prisma/client"

const LOCALE_LABEL: Record<string, string> = { en: "English", fr: "Français" }

export const dynamic = "force-dynamic"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null, locale: string) {
  if (!d) return ""
  return new Date(d).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = normalizeLocale(rawLocale) as LocaleCode
  const post = await getPublicBlogPost(locale, slug)
  if (!post) return {}

  const siteUrl = getSiteUrl()
  const title = post.seoTitle || post.title
  const description = post.seoDesc || post.excerpt

  const altLocales = await getPostAlternateLocales(locale, slug)
  const languages: Record<string, string> = {}
  for (const alt of altLocales) {
    languages[alt.locale] = `${siteUrl}/${alt.locale}/blog/${alt.slug}`
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      url: `${siteUrl}/${locale}/blog/${slug}`,
      images: post.coverUrl ? [{ url: post.coverUrl, alt: post.coverAlt ?? title }] : [],
    },
    twitter: { card: "summary_large_image", title, description, images: post.coverUrl ? [post.coverUrl] : [] },
    alternates: {
      canonical: `${siteUrl}/${locale}/blog/${slug}`,
      languages,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale: rawLocale, slug } = await params
  const locale = normalizeLocale(rawLocale) as LocaleCode

  const [post, t] = await Promise.all([
    getPublicBlogPost(locale, slug),
    getTranslations({ locale, namespace: "marketing.blogDetailPage" }),
  ])

  // No version of this post in the requested locale — redirect gracefully
  if (!post) redirect(`/${locale}/blog`)

  const [suggested, alternates] = await Promise.all([
    getSuggestedPosts(locale, post.id, post.category, 3),
    getPostAlternateLocales(locale, slug),
  ])

  // Other-locale versions of this post (excludes the current locale)
  const otherLocales = alternates.filter((a) => a.locale !== locale)

  const safeHtml = sanitizeHtml(post.contentHtml, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "ul", "ol", "li", "blockquote", "pre", "code",
      "strong", "em", "u", "s", "a", "img", "br", "hr",
      "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
      "video", "source",
      "div", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: ["src", "alt", "class", "width", "height", "loading", "data-align"],
      video: ["src", "controls", "preload", "class", "style", "poster", "data-blog-video", "width", "height", "data-align"],
      source: ["src", "type"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow", "frameborder", "class", "style", "data-align"],
      div: ["class", "style", "data-youtube-video"],
      "*": ["class"],
    },
    allowedIframeHostnames: [
      "www.youtube.com", "youtube.com",
      "www.youtube-nocookie.com", "youtube-nocookie.com",
      "player.vimeo.com", "www.vimeo.com",
    ],
  })

  const siteUrl = getSiteUrl()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverUrl ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    url: `${siteUrl}/${locale}/blog/${slug}`,
    publisher: { "@type": "Organization", name: "Contrazy" },
  }

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-(--contrazy-bg-muted)">

        {/* ─ Article ─────────────────────────────────────────────────────────
            Same max-w-7xl + px-5 lg:px-10 as the nav — left edge aligns
            with the logo at every breakpoint.
            On lg+ a two-column flex row fills the available width:
              left  flex-1  → header + cover + body  (~848 px at 1280 container)
              right w-72    → sticky metadata sidebar
            Mobile: single column, sidebar hidden.                              */}
        <article className="mx-auto max-w-7xl px-5 pb-24 pt-16 lg:px-10 lg:pt-24 xl:pt-28">

          {/* Breadcrumb — always full-width above both columns */}
          <nav className="mb-10 flex items-center gap-2 text-sm text-muted-foreground/70">
            <Link href="/blog" className="transition-colors hover:text-(--contrazy-teal)">Blog</Link>
            <span className="text-muted-foreground/40">/</span>
            {post.category && (
              <>
                <span className="text-muted-foreground/70">{post.category}</span>
                <span className="text-muted-foreground/40">/</span>
              </>
            )}
            <span className="truncate text-foreground/80">{post.title}</span>
          </nav>

          {/* Two-column layout */}
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16 xl:gap-20">

            {/* ── Left: main content ─────────────────────────────────────── */}
            <div className="min-w-0 flex-1">

              <header className="mb-14">
                {post.category && (
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[2.5px] text-(--contrazy-teal)">
                    {post.category}
                  </p>
                )}

                <h1 className="font-heading text-[2.25rem] font-bold leading-[1.15] tracking-[-0.6px] text-foreground sm:text-[2.75rem] lg:text-[3.5rem]">
                  {post.title}
                </h1>

                <p className="mt-6 max-w-2xl text-[1.0625rem] leading-[1.8] text-muted-foreground sm:text-[1.125rem]">
                  {post.excerpt}
                </p>

                {/* Meta + tags visible on mobile (sidebar is hidden there) */}
                {post.publishedAt && (
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground/60">
                    <span>{formatDate(post.publishedAt, locale)}</span>
                  </div>
                )}

                {post.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
                    {post.tags.map((tag) => (
                      <span key={tag}
                        className="rounded-full border border-(--contrazy-teal)/20 bg-(--contrazy-teal)/8 px-3 py-1 text-[12px] font-medium text-(--contrazy-teal)">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Language versions — mobile only (sidebar handles desktop) */}
                {otherLocales.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
                    <span className="text-[12px] text-muted-foreground/50">{t("alsoIn")}</span>
                    {otherLocales.map((alt) => (
                      <Link
                        key={alt.locale}
                        href={`/blog/${alt.slug}`}
                        locale={alt.locale}
                        className="inline-flex items-center rounded-lg border border-(--contrazy-teal)/25 bg-(--contrazy-teal)/8 px-2.5 py-1 text-[12px] font-semibold text-(--contrazy-teal) transition-opacity hover:opacity-75"
                      >
                        {LOCALE_LABEL[alt.locale] ?? alt.locale.toUpperCase()}
                      </Link>
                    ))}
                  </div>
                )}
              </header>

              {/* Cover — fills entire left column width */}
              {post.coverUrl && (
                <div className="mb-16 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-[0_4px_32px_rgb(15_23_42/0.08)]">
                  <div className="relative aspect-video w-full">
                    <Image
                      src={post.coverUrl}
                      alt={post.coverAlt ?? post.title}
                      fill
                      sizes="(min-width: 1280px) 848px, (min-width: 1024px) calc(100vw - 80px - 18rem), calc(100vw - 40px)"
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              )}

              {!post.coverUrl && <div className="mb-14 border-t border-border/60" />}

              {/* Body */}
              <div
                className="blog-editor-preview blog-post-content"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />

              <footer className="mt-16 border-t border-border/60 pt-10">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-(--contrazy-teal) transition-opacity hover:opacity-75"
                >
                  {t("backToBlog")}
                </Link>
              </footer>
            </div>

            {/* ── Right: sticky sidebar (lg+) ────────────────────────────── */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0 lg:self-stretch xl:w-80">
              <div className="sticky top-24 space-y-4">

                {/* Article info */}
                <div className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[2px] text-muted-foreground/50">
                    {t("sidebar.articleInfo")}
                  </p>
                  <div className="space-y-3">
                    {post.category && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[13px] text-muted-foreground/60">{t("sidebar.category")}</span>
                        <span className="text-right text-[13px] font-semibold text-(--contrazy-teal)">
                          {post.category}
                        </span>
                      </div>
                    )}
                    {post.publishedAt && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[13px] text-muted-foreground/60">{t("sidebar.published")}</span>
                        <span className="text-right text-[13px] font-medium text-foreground">
                          {formatDate(post.publishedAt, locale)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[2px] text-muted-foreground/50">
                      {t("sidebar.tags")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag}
                          className="rounded-full border border-(--contrazy-teal)/20 bg-(--contrazy-teal)/8 px-3 py-1 text-[12px] font-medium text-(--contrazy-teal)">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Language versions — correct slug per locale */}
                {otherLocales.length > 0 && (
                  <div className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[2px] text-muted-foreground/50">
                      {t("sidebar.alsoAvailableIn")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {otherLocales.map((alt) => (
                        <Link
                          key={alt.locale}
                          href={`/blog/${alt.slug}`}
                          locale={alt.locale}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-(--contrazy-teal)/25 bg-(--contrazy-teal)/8 px-3 py-1.5 text-[12px] font-semibold text-(--contrazy-teal) transition-opacity hover:opacity-75"
                        >
                          {LOCALE_LABEL[alt.locale] ?? alt.locale.toUpperCase()}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Back link */}
                <Link
                  href="/blog"
                  className="flex items-center gap-1.5 px-1 text-sm font-medium text-(--contrazy-teal) transition-opacity hover:opacity-75"
                >
                  {t("backToBlog")}
                </Link>
              </div>
            </aside>

          </div>
        </article>

        {/* ─ Suggested posts ──────────────────────────────────────────────── */}
        {suggested.length > 0 && (
          <section className="border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-20">

              <div className="mb-10 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[2px] text-(--contrazy-teal)">
                    {t("suggested.eyebrow")}
                  </p>
                  <h2 className="text-[1.5rem] font-bold leading-tight text-foreground">
                    {post.category
                      ? t("suggested.moreInCategory", { category: post.category })
                      : t("suggested.moreFromBlog")}
                  </h2>
                </div>
                <Link
                  href="/blog"
                  className="hidden shrink-0 text-sm font-medium text-(--contrazy-teal) transition-opacity hover:opacity-75 sm:block"
                >
                  {t("suggested.viewAll")}
                </Link>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {suggested.map((s) => (
                  <Link key={s.id} href={`/blog/${s.slug}`} className="group block">
                    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgb(15_23_42/0.1)]">

                      {/* Thumbnail */}
                      <div className="relative h-45 overflow-hidden border-b border-border bg-linear-to-br from-[#eefaf7] via-white to-[#eff6ff]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(17,201,176,0.12),transparent_60%)]" />
                        {s.coverUrl ? (
                          <Image
                            src={s.coverUrl}
                            alt={s.coverAlt ?? s.title}
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 100vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-5xl font-bold text-(--contrazy-teal)/15">
                              {s.title.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        {s.category && (
                          <p className="text-[10px] font-bold uppercase tracking-[2px] text-(--contrazy-teal)">
                            {s.category}
                          </p>
                        )}
                        <h3 className="line-clamp-2 text-[15px] font-bold leading-[1.4] text-foreground">
                          {s.title}
                        </h3>
                        <p className="mt-auto line-clamp-2 text-[13px] leading-[1.6] text-muted-foreground/70">
                          {s.excerpt}
                        </p>
                        <p className="mt-2 text-[12px] text-muted-foreground/50">
                          {formatDate(s.publishedAt, locale)}
                        </p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex justify-center sm:hidden">
                <Link
                  href="/blog"
                  className="text-sm font-medium text-(--contrazy-teal) transition-opacity hover:opacity-75"
                >
                  {t("suggested.viewAll")}
                </Link>
              </div>
            </div>
          </section>
        )}

      </div>
    </PublicShell>
  )
}
