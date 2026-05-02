"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardFilterOption } from "@/features/dashboard/filter-options"
import { cn } from "@/lib/utils"

type TableQueryFilter = {
  name: string
  label: string
  value?: string
  options: DashboardFilterOption[]
}

type TableQueryShellProps = {
  basePath: string
  searchValue?: string
  searchPlaceholder?: string
  filters?: TableQueryFilter[]
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  searchParams?: Record<string, string>
  children: React.ReactNode
}

function buildPageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const result: (number | "...")[] = [1]

  if (current > 3) result.push("...")

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let page = start; page <= end; page += 1) {
    result.push(page)
  }

  if (current < total - 2) result.push("...")

  result.push(total)
  return result
}

function TablePendingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-20 rounded-xl border border-border/60 bg-background/72 backdrop-blur-[2px]"
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LoaderCircle className="size-4 animate-spin text-[var(--contrazy-teal)]" />
          Updating results
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function TableQueryShell({
  basePath,
  searchValue = "",
  searchPlaceholder = "Search records",
  filters = [],
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  searchParams,
  children,
}: TableQueryShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(searchValue)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>(
    Object.fromEntries(filters.map((filter) => [filter.name, filter.value ?? "all"]))
  )

  const searchId = useMemo(() => `${basePath.replaceAll("/", "-")}-search`, [basePath])

  const start = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const end = totalCount > 0 ? Math.min(currentPage * pageSize, totalCount) : 0
  const pages = buildPageWindow(currentPage, totalPages)

  function navigate(nextParams: URLSearchParams | string) {
    const target = typeof nextParams === "string" ? nextParams : `${basePath}?${nextParams.toString()}`
    startTransition(() => {
      router.replace(target, { scroll: false })
    })
  }

  function createBaseParams() {
    return new URLSearchParams(searchParams)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params = new URLSearchParams()
    const normalizedQuery = query.trim()

    if (normalizedQuery) {
      params.set("q", normalizedQuery)
    }

    for (const filter of filters) {
      const value = selectedFilters[filter.name]
      if (value && value !== "all") {
        params.set(filter.name, value)
      }
    }

    navigate(params.toString() ? params : basePath)
  }

  function handleReset() {
    setQuery("")
    setSelectedFilters(Object.fromEntries(filters.map((filter) => [filter.name, "all"])))
    navigate(basePath)
  }

  function handlePageChange(page: number) {
    const params = createBaseParams()
    params.set("page", String(page))
    navigate(params)
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-3 lg:flex-row lg:items-end"
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor={searchId}
            className="mb-1.5 block text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
          >
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              name="q"
              value={query}
              placeholder={searchPlaceholder}
              className="h-9 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        {filters.map((filter) => (
          <div key={filter.name} className="w-full lg:w-[180px]">
            <label className="mb-1.5 block text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {filter.label}
            </label>
            <div className="relative">
              <select
                name={filter.name}
                value={selectedFilters[filter.name] ?? "all"}
                disabled={isPending}
                onChange={(event) =>
                  setSelectedFilters((current) => ({
                    ...current,
                    [filter.name]: event.target.value,
                  }))
                }
                className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
              >
                <option value="all">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 lg:ml-auto">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" />
                Applying
              </>
            ) : (
              "Apply"
            )}
          </Button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "cursor-pointer disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
      </form>

      <div className="relative" aria-busy={isPending}>
        <motion.div
          animate={{ opacity: isPending ? 0.6 : 1, scale: isPending ? 0.995 : 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-4"
        >
          {children}

          {totalCount > pageSize ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{start}–{end}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount}</span> results
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </button>

                {pages.map((page, index) =>
                  page === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      disabled={page === currentPage || isPending}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "min-w-[2rem] cursor-pointer disabled:opacity-60",
                        page === currentPage &&
                          "pointer-events-none border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] hover:text-white"
                      )}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>

        <AnimatePresence>{isPending ? <TablePendingOverlay /> : null}</AnimatePresence>
      </div>
    </div>
  )
}
