import { cn } from "@/lib/utils"

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-muted", className)} />
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-background p-5 space-y-3">
      <Shimmer className="h-4 w-32" />
      <Shimmer className="h-8 w-24" />
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
      <Shimmer className="h-4 w-28" />
      <Shimmer className="h-4 w-40 flex-1" />
      <Shimmer className="h-5 w-20 rounded-full" />
      <Shimmer className="h-4 w-24" />
      <Shimmer className="h-8 w-16 rounded-lg" />
    </div>
  )
}

export function DashboardPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Table / list */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/40">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-36 flex-1" />
          <Shimmer className="h-3 w-16" />
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-12" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function DashboardDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back + title bar */}
      <div className="flex items-center gap-3">
        <Shimmer className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-3 w-32" />
        </div>
        <div className="ml-auto flex gap-2">
          <Shimmer className="h-8 w-24 rounded-lg" />
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Main content card */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-4">
        <Shimmer className="h-5 w-40" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary card */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-3">
        <Shimmer className="h-5 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Shimmer key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardSimpleSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Shimmer className="h-5 w-48" />
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-0">
            <Shimmer className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-52" />
            </div>
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
