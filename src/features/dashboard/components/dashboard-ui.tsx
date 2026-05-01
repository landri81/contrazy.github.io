import Link from "next/link"
import { ArrowRight, CircleAlert, CircleCheck, Clock3, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "neutral" | "info"

function formatBadgeLabel(value: React.ReactNode) {
  if (typeof value !== "string") {
    return value
  }

  const normalized = value.replaceAll("_", " ").trim()

  if (!normalized) {
    return value
  }

  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const toneClasses: Record<Tone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  }

  return <Badge className={cn("border", toneClasses[tone])}>{formatBadgeLabel(children)}</Badge>
}

export function PagePanel({
  title,
  description,
  actionHref,
  actionLabel,
  children,
}: {
  title: string
  description?: string
  actionHref?: string
  actionLabel?: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border bg-card py-4 shadow-sm">
      <CardHeader className="border-b border-border/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actionHref && actionLabel ? (
            <Link href={actionHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {actionLabel}
              <ExternalLink className="size-4" />
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function KpiGrid({
  items,
}: {
  items: { label: string; value: string; detail?: string; tone?: Tone }[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-border bg-card py-4 shadow-sm">
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{item.value}</p>
            {item.detail ? (
              item.tone ? (
                <div className="text-xs">
                  <StatusBadge tone={item.tone}>{item.detail}</StatusBadge>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              )
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AlertStrip({
  items,
}: {
  items: { title: string; description: string; tone: Tone; href?: string; hrefLabel?: string }[]
}) {
  const toneClasses: Record<Tone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className={cn("rounded-lg border p-4 text-sm", toneClasses[item.tone])}>
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 leading-6 opacity-90">{item.description}</p>
              {item.href && item.hrefLabel ? (
                <Link href={item.href} className="mt-3 inline-flex items-center gap-1 font-medium">
                  {item.hrefLabel}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardTable({
  columns,
  rows,
  emptyMessage = "No records yet.",
}: {
  columns: string[]
  rows: React.ReactNode[][]
  emptyMessage?: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function DetailGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode }[]
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-muted p-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{item.label}</p>
          <div className="mt-2 text-sm font-medium text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

export function TimelineList({
  items,
}: {
  items: { title: string; detail: string; pending?: boolean }[]
}) {
  return (
    <div className="space-y-4 border-l-2 border-border pl-5">
      {items.map((item) => (
        <div key={`${item.title}-${item.detail}`} className="relative">
          <span className="absolute -left-[29px] top-1 inline-flex size-3 items-center justify-center rounded-full border-2 border-card bg-[var(--contrazy-teal)]">
            {item.pending ? <Clock3 className="size-2 text-white" /> : <CircleCheck className="size-2 text-white" />}
          </span>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function ResourceCards({
  items,
  emptyTitle = "Nothing here yet",
  emptyDescription = "This section will fill in as soon as you add your first item.",
}: {
  items: { title: string; description: string; tag?: string; meta?: string }[]
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-border bg-card py-4 shadow-sm">
        <CardContent className="py-10 text-center">
          <h3 className="text-base font-semibold text-foreground">{emptyTitle}</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} className="border-border bg-card py-4 shadow-sm">
          <CardContent>
            {item.tag ? <StatusBadge tone="neutral">{item.tag}</StatusBadge> : null}
            <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            {item.meta ? <p className="mt-4 text-xs text-muted-foreground">{item.meta}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
