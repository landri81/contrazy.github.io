"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Pencil, Plus, Search } from "lucide-react"
import { useCallback, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import type { BlogPostListItem } from "@/features/blog/server/blog-data"
import type { PaginationMeta } from "@/lib/pagination"

const STATUS_COLORS = {
  DRAFT: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
} as const

type Props = {
  items: BlogPostListItem[]
  meta: PaginationMeta
  searchParams: Record<string, string>
}

export function AdminBlogList({ items, meta, searchParams: initialSearchParams }: Props) {
  const t = useTranslations("dashboard.admin.blog")
  const router = useRouter()
  const searchParamsHook = useSearchParams()
  const q = searchParamsHook.get("q") ?? ""
  const status = searchParamsHook.get("status") ?? ""
  const searchRef = useRef<HTMLInputElement>(null)

  const buildUrl = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParamsHook.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === "" || v === 0) params.delete(k)
        else params.set(k, String(v))
      }
      return `?${params.toString()}`
    },
    [searchParamsHook]
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value ?? ""
    router.push(buildUrl({ q, page: 1 }))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("listTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("listDescription")}</p>
        </div>
        <Link href="/admin/blog/new">
          <Button className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]">
            <Plus className="mr-1.5 size-4" />
            {t("newPost")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative min-w-0 flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            defaultValue={q}
            type="search"
            placeholder="Search posts…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30"
          />
        </form>

        <div className="flex gap-1.5">
          {(["", "DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((s) => (
            <Link
              key={s}
              href={buildUrl({ status: s, page: 1 })}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === s
                  ? "bg-[var(--contrazy-teal)] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {s === "" ? "All" : t(`status.${s}`)}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">{t("noPosts")}</p>
          <Link href="/admin/blog/new">
            <Button size="sm" className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]">
              <Plus className="mr-1.5 size-3.5" />
              {t("newPost")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/70">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("table.title")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("table.status")}</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">{t("table.locale")}</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">{t("table.updatedAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((post) => {
                const enLocale = post.locales.find((l) => l.locale === "en")
                const frLocale = post.locales.find((l) => l.locale === "fr")
                const display = enLocale ?? frLocale ?? post.locales[0]

                return (
                  <tr key={post.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground line-clamp-1">
                          {display?.title ?? "—"}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {display?.excerpt ?? ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_COLORS[post.status])}>
                          {t(`status.${post.status}`)}
                        </span>
                        {post.featured && (
                          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                            {t("table.featured")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex gap-1.5">
                        {post.locales.map((l) => (
                          <span
                            key={l.locale}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-600"
                          >
                            {l.locale}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {post.updatedAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/blog/${post.id}`}>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                          <Pencil className="size-3.5" />
                          {t("editPost")}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("postsCount", { count: meta.totalCount })}
          </p>
          <div className="flex gap-2">
            {meta.page > 1 && (
              <Link href={buildUrl({ page: meta.page - 1 })}>
                <Button size="sm" variant="outline">← Previous</Button>
              </Link>
            )}
            {meta.page < meta.totalPages && (
              <Link href={buildUrl({ page: meta.page + 1 })}>
                <Button size="sm" variant="outline">Next →</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
