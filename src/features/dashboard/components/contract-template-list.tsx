"use client"

import type { ContractTemplate } from "@prisma/client"
import {
  CalendarClock,
  Edit,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import { summarizeContractTemplate } from "@/features/contracts/template-authoring"
import {
  contractTemplateFilterOptions,
  contractTemplateSortOptions,
  CONTRACT_TEMPLATE_PAGE_SIZE,
  DEFAULT_CONTRACT_TEMPLATE_FILTER,
  DEFAULT_CONTRACT_TEMPLATE_SORT,
  type ContractTemplateFilterValue,
  type ContractTemplateSortValue,
} from "@/features/contracts/template-listing"
import { cn } from "@/lib/utils"

type ContractTemplateListResponse = {
  items: ContractTemplate[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  message?: string
}

function formatDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown"
  }

  return parsed.toLocaleDateString()
}

function buildPageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const result: (number | "...")[] = [1]

  if (current > 3) {
    result.push("...")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let page = start; page <= end; page += 1) {
    result.push(page)
  }

  if (current < total - 2) {
    result.push("...")
  }

  result.push(total)
  return result
}

export function ContractTemplateList({
  initialTemplates,
  initialTotalCount,
  initialPageSize = CONTRACT_TEMPLATE_PAGE_SIZE,
  canEdit,
  blockedMessage,
  templateLimit,
  templateLimitMessage,
}: {
  initialTemplates: ContractTemplate[]
  initialTotalCount: number
  initialPageSize?: number
  canEdit: boolean
  blockedMessage: string
  templateLimit: number | null
  templateLimitMessage: string | null
}) {
  const requestSequenceRef = useRef(0)
  const [templates, setTemplates] = useState(initialTemplates)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: initialPageSize,
    totalCount: initialTotalCount,
    totalPages: Math.max(1, Math.ceil(initialTotalCount / initialPageSize)),
  })
  const [criteria, setCriteria] = useState<{
    q: string
    filter: ContractTemplateFilterValue
    sort: ContractTemplateSortValue
  }>({
    q: "",
    filter: DEFAULT_CONTRACT_TEMPLATE_FILTER,
    sort: DEFAULT_CONTRACT_TEMPLATE_SORT,
  })
  const [draftQuery, setDraftQuery] = useState("")
  const [draftFilter, setDraftFilter] =
    useState<ContractTemplateFilterValue>(DEFAULT_CONTRACT_TEMPLATE_FILTER)
  const [draftSort, setDraftSort] =
    useState<ContractTemplateSortValue>(DEFAULT_CONTRACT_TEMPLATE_SORT)
  const [isLoading, setIsLoading] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<ContractTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const hasReachedTemplateLimit =
    templateLimit !== null && pagination.totalCount >= templateLimit

  const canCreate = canEdit && !hasReachedTemplateLimit
  const createBlockedMessage = hasReachedTemplateLimit
    ? templateLimitMessage ?? "Your current plan limit has been reached."
    : null

  const hasActiveFilters =
    Boolean(criteria.q) ||
    criteria.filter !== DEFAULT_CONTRACT_TEMPLATE_FILTER ||
    criteria.sort !== DEFAULT_CONTRACT_TEMPLATE_SORT

  const visibleRangeStart =
    pagination.totalCount > 0
      ? (pagination.page - 1) * pagination.pageSize + 1
      : 0
  const visibleRangeEnd =
    pagination.totalCount > 0
      ? Math.min(pagination.page * pagination.pageSize, pagination.totalCount)
      : 0
  const pageWindow = useMemo(
    () => buildPageWindow(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages]
  )

  async function loadTemplates({
    q,
    filter,
    sort,
    page,
  }: {
    q: string
    filter: ContractTemplateFilterValue
    sort: ContractTemplateSortValue
    page: number
  }) {
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    setIsLoading(true)

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pagination.pageSize),
    })

    const normalizedQuery = q.trim()

    if (normalizedQuery) {
      params.set("q", normalizedQuery)
    }

    if (filter !== DEFAULT_CONTRACT_TEMPLATE_FILTER) {
      params.set("filter", filter)
    }

    if (sort !== DEFAULT_CONTRACT_TEMPLATE_SORT) {
      params.set("sort", sort)
    }

    try {
      const response = await fetch(`/api/vendor/contracts?${params.toString()}`)
      const payload = (await response.json().catch(() => null)) as ContractTemplateListResponse | null

      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? "Unable to load templates right now.")
      }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      setCriteria({ q: normalizedQuery, filter, sort })
      setTemplates(payload.items)
      setPagination({
        page: payload.page,
        pageSize: payload.pageSize,
        totalCount: payload.totalCount,
        totalPages: payload.totalPages,
      })
    } catch (error) {
      console.error(error)

      if (requestId !== requestSequenceRef.current) {
        return
      }

      toast({
        variant: "error",
        title: "Failed to load templates",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsLoading(false)
      }
    }
  }

  function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadTemplates({
      q: draftQuery,
      filter: draftFilter,
      sort: draftSort,
      page: 1,
    })
  }

  function handleReset() {
    setDraftQuery("")
    setDraftFilter(DEFAULT_CONTRACT_TEMPLATE_FILTER)
    setDraftSort(DEFAULT_CONTRACT_TEMPLATE_SORT)

    void loadTemplates({
      q: "",
      filter: DEFAULT_CONTRACT_TEMPLATE_FILTER,
      sort: DEFAULT_CONTRACT_TEMPLATE_SORT,
      page: 1,
    })
  }

  function handlePageChange(nextPage: number) {
    if (isLoading || nextPage < 1 || nextPage > pagination.totalPages) {
      return
    }

    void loadTemplates({
      q: criteria.q,
      filter: criteria.filter,
      sort: criteria.sort,
      page: nextPage,
    })
  }

  async function handleConfirmDelete() {
    if (!deletingTemplate || deletingId) {
      return
    }

    setDeletingId(deletingTemplate.id)

    try {
      const response = await fetch(`/api/vendor/contracts/${deletingTemplate.id}`, {
        method: "DELETE",
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok && response.status !== 204) {
        toast({
          variant: "error",
          title: "Delete failed",
          description: payload?.message ?? "Unable to delete this template right now.",
        })
        return
      }

      const deletedName = deletingTemplate.name
      setDeletingTemplate(null)

      const nextPage =
        templates.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page

      toast({
        variant: "success",
        title: "Template deleted",
        description: `${deletedName} has been removed.`,
      })

      await loadTemplates({
        q: criteria.q,
        filter: criteria.filter,
        sort: criteria.sort,
        page: nextPage,
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "error",
        title: "Network error",
        description: "Unable to delete this template right now.",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <CardContent className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                  <FileText className="size-5" />
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Contract templates
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    Maintain reusable agreements in one place, then attach them to transactions when needed.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
                  {pagination.totalCount} total
                </Badge>
                {templateLimit === null ? (
                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    Unlimited on current plan
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full border-border/80 bg-muted/30 px-2.5 py-1">
                    {Math.max(templateLimit - pagination.totalCount, 0)} remaining
                  </Badge>
                )}
              </div>
            </div>

            {canCreate ? (
              <DashboardRouteLink
                href="/vendor/contracts/new"
                pendingLabel="Opening editor"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] sm:w-auto"
                )}
              >
                <Plus className="size-4" />
                New template
              </DashboardRouteLink>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled
                title={createBlockedMessage ?? (!canEdit ? blockedMessage : undefined)}
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" />
                New template
              </Button>
            )}
          </div>

          {!canEdit ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTitle>Editing unavailable</AlertTitle>
              <AlertDescription>{blockedMessage}</AlertDescription>
            </Alert>
          ) : null}

          {canEdit && hasReachedTemplateLimit && createBlockedMessage ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTitle>Template limit reached</AlertTitle>
              <AlertDescription>{createBlockedMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={handleApply}
            className="rounded-2xl border border-border/80 bg-[var(--contrazy-bg-muted)]/55 p-3.5"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_200px_180px_auto] lg:items-end">
              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                    placeholder="Search by template name or note"
                    className="h-10 bg-white pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Filter
                </label>
                <Select
                  value={draftFilter}
                  onValueChange={(value) =>
                    setDraftFilter((value ?? DEFAULT_CONTRACT_TEMPLATE_FILTER) as ContractTemplateFilterValue)
                  }
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTemplateFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sort
                </label>
                <Select
                  value={draftSort}
                  onValueChange={(value) =>
                    setDraftSort((value ?? DEFAULT_CONTRACT_TEMPLATE_SORT) as ContractTemplateSortValue)
                  }
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTemplateSortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 px-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Applying
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="h-10 px-4"
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
              </div>
            </div>
          </form>

          <div className="rounded-2xl border border-border/80 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Template library</h2>
                <p className="text-xs text-muted-foreground">
                  {pagination.totalCount > 0
                    ? `Showing ${visibleRangeStart}-${visibleRangeEnd} of ${pagination.totalCount}`
                    : hasActiveFilters
                      ? "No templates match the current search or filter."
                      : "No templates created yet."}
                </p>
              </div>
            </div>

            <div className="relative">
              {isLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-white/80 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Updating templates
                  </div>
                </div>
              ) : null}

              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                    <FileSearch className="size-7 text-muted-foreground" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {hasActiveFilters ? "No matching templates" : "No templates yet"}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {hasActiveFilters
                      ? "Try a different search term or reset the current filters."
                      : "Create your first reusable agreement and keep it ready for future transactions."}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {hasActiveFilters ? (
                      <Button type="button" variant="outline" onClick={handleReset}>
                        <RotateCcw className="size-4" />
                        Clear filters
                      </Button>
                    ) : null}

                    {canCreate ? (
                      <DashboardRouteLink
                        href="/vendor/contracts/new"
                        pendingLabel="Opening editor"
                        className={cn(
                          buttonVariants({ size: "lg" }),
                          "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
                        )}
                      >
                        <Plus className="size-4" />
                        Create first template
                      </DashboardRouteLink>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-11 px-5">Template</TableHead>
                          <TableHead className="h-11 px-5">Summary</TableHead>
                          <TableHead className="h-11 px-5">Updated</TableHead>
                          <TableHead className="h-11 px-5 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((template) => (
                          <TableRow key={template.id}>
                            <TableCell className="px-5 py-4 align-top whitespace-normal">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                                  <FileText className="size-4" />
                                </div>

                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-foreground">{template.name}</p>
                                    {template.isDefault ? (
                                      <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                                        Default
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {template.description?.trim() || "No internal note added."}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="max-w-xl px-5 py-4 align-top whitespace-normal">
                              <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {summarizeContractTemplate(template.content)}
                              </p>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-top whitespace-normal">
                              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CalendarClock className="mt-0.5 size-4 shrink-0" />
                                <div className="space-y-0.5">
                                  <p className="font-medium text-foreground">
                                    {formatDate(template.updatedAt)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Created {formatDate(template.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="px-5 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {canEdit ? (
                                  <DashboardRouteLink
                                    href={`/vendor/contracts/${template.id}/edit`}
                                    pendingLabel="Opening editor"
                                    className={buttonVariants({ variant: "outline", size: "sm" })}
                                  >
                                    <Edit className="size-4" />
                                    Edit
                                  </DashboardRouteLink>
                                ) : (
                                  <Button type="button" variant="outline" size="sm" disabled>
                                    <Edit className="size-4" />
                                    Edit
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingTemplate(template)}
                                  disabled={!canEdit || Boolean(deletingId)}
                                  className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  {deletingId === template.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4" />
                                  )}
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 p-3 md:hidden">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="rounded-2xl border border-border/80 bg-white p-3 shadow-sm sm:p-4"
                        >
                          <div className="flex gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] sm:size-10 sm:rounded-2xl">
                              <FileText className="size-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate font-semibold text-foreground">
                                      {template.name}
                                    </p>

                                    {template.isDefault ? (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 rounded-full border-blue-200 bg-blue-50 px-2 py-0 text-[10px] text-blue-700"
                                      >
                                        Default
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                                    {template.description?.trim() || "No internal note added."}
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                  {canEdit ? (
                                    <DashboardRouteLink
                                      href={`/vendor/contracts/${template.id}/edit`}
                                      pendingLabel="Opening editor"
                                      className={cn(
                                        buttonVariants({ variant: "ghost", size: "icon" }),
                                        "size-8 rounded-full"
                                      )}
                                      aria-label={`Edit ${template.name}`}
                                    >
                                      <Edit className="size-4" />
                                    </DashboardRouteLink>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled
                                      className="size-8 rounded-full"
                                      aria-label="Edit disabled"
                                    >
                                      <Edit className="size-4" />
                                    </Button>
                                  )}

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingTemplate(template)}
                                    disabled={!canEdit || Boolean(deletingId)}
                                    className="size-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Delete ${template.name}`}
                                  >
                                    {deletingId === template.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-3 sm:text-sm">
                                {summarizeContractTemplate(template.content)}
                              </p>

                              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                                <CalendarClock className="size-3.5 shrink-0" />
                                <span className="truncate">Updated {formatDate(template.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>

            {pagination.totalCount > pagination.pageSize ? (
              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{visibleRangeStart}-{visibleRangeEnd}</span> of{" "}
                  <span className="font-medium text-foreground">{pagination.totalCount}</span> templates
                </p>

                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1 || isLoading}
                  >
                    Prev
                  </Button>

                  {pageWindow.map((entry, index) =>
                    entry === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-1 text-sm text-muted-foreground"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={entry}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(entry)}
                        disabled={isLoading || entry === pagination.page}
                        className={cn(
                          "min-w-9",
                          entry === pagination.page &&
                            "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] hover:text-white disabled:opacity-100"
                        )}
                      >
                        {entry}
                      </Button>
                    )
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(deletingTemplate)}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setDeletingTemplate(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              {deletingTemplate
                ? `Delete "${deletingTemplate.name}"? Existing transaction snapshots stay unchanged.`
                : "Delete this template?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTemplate(null)}
              disabled={Boolean(deletingId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={Boolean(deletingId)}
            >
              {deletingId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
