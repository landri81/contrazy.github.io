"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Search } from "lucide-react"
import Image from "next/image"
import { useRef } from "react"

import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PublicPost, PaginationMeta } from "./blog-index-types"

export type { PublicPost, PaginationMeta }

type Props = {
  posts: PublicPost[]
  featuredPost: PublicPost | null
  meta: PaginationMeta
}

function formatDate(d: Date | string | null, locale: string) {
  if (!d) return ""
  return new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
}

export function BlogIndexPage({ posts, featuredPost, meta }: Props) {
  const t = useTranslations("marketing.blogPage")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const q = searchParams.get("q") ?? ""
  const searchRef = useRef<HTMLInputElement>(null)

  function buildUrl(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === "" || v === 0) params.delete(k)
      else params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ q: searchRef.current?.value ?? "", page: 1 }))
  }

  const grid = featuredPost
    ? posts.filter((p) => p.id !== featuredPost.id)
    : posts

  return (
    <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">

        {/* Page header */}
        <div className="mb-10 max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
          </h1>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            {t("description")}
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-10 flex max-w-sm gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              defaultValue={q}
              type="search"
              placeholder={t("searchPlaceholder")}
              className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30"
            />
          </div>
          <Button type="submit" size="sm" className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] h-10">
            {t("searchBtn")}
          </Button>
        </form>

        {/* Featured post */}
        {featuredPost && !q && meta.page === 1 && (
          <Link href={`/blog/${featuredPost.slug}`} className="mb-12 block">
            <div className="grid cursor-pointer overflow-hidden rounded-[20px] border border-border bg-background transition-all hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-2">
              <div className="relative min-h-[300px] overflow-hidden border-b border-border bg-linear-to-br from-[#eefaf7] via-white to-[#eff6ff] sm:border-b-0 sm:border-r">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.16),transparent_58%)]" />
                <div className="absolute inset-0 p-6 sm:p-8">
                  <div className="relative h-full overflow-hidden rounded-[18px] border border-white/80 bg-white/70 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                    {featuredPost.coverUrl ? (
                      <Image
                        src={featuredPost.coverUrl}
                        alt={featuredPost.coverAlt ?? featuredPost.title}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[var(--contrazy-teal)]/10 to-transparent">
                        <span className="text-5xl font-bold text-[var(--contrazy-teal)]/30">
                          {featuredPost.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center p-10 sm:p-12">
                {featuredPost.category && (
                  <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                    {featuredPost.category}
                  </p>
                )}
                <h2 className="mt-2 text-[22px] font-bold leading-[1.35] text-foreground">
                  {featuredPost.title}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
                <p className="mt-4 text-[12px] text-muted-foreground/70">
                  {formatDate(featuredPost.publishedAt, locale)}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Grid */}
        {grid.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group h-full cursor-pointer overflow-hidden rounded-[16px] border border-border bg-background transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative h-[190px] overflow-hidden border-b border-border bg-linear-to-br from-[#eefaf7] via-white to-[#eff6ff] p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.14),transparent_62%)]" />
                    <div className="relative h-full overflow-hidden rounded-[14px] border border-white/80 bg-white/80 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      {post.coverUrl ? (
                        <Image
                          src={post.coverUrl}
                          alt={post.coverAlt ?? post.title}
                          fill
                          sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-4xl font-bold text-[var(--contrazy-teal)]/20">
                            {post.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    {post.category && (
                      <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                        {post.category}
                      </p>
                    )}
                    <h3 className="mt-2 text-[16px] font-bold leading-[1.35] text-foreground line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground line-clamp-3">
                      {post.excerpt}
                    </p>
                    <p className="mt-3 text-[12px] text-muted-foreground/60">
                      {formatDate(post.publishedAt, locale)}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground">
              {q ? t("noPostsFoundFor", { q }) : t("noPostsFound")}
            </p>
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            {meta.page > 1 && (
              <Link href={buildUrl({ page: meta.page - 1 })}>
                <Button variant="outline">{t("prev")}</Button>
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {t("pageOf", { page: meta.page, total: meta.totalPages })}
            </span>
            {meta.page < meta.totalPages && (
              <Link href={buildUrl({ page: meta.page + 1 })}>
                <Button variant="outline">{t("next")}</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
