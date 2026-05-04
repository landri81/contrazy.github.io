function BillingSkeletonBlock({
  className,
}: {
  className?: string
}) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ""}`.trim()} />
}

export default function VendorBillingLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BillingSkeletonBlock className="h-8 w-32" />
        <BillingSkeletonBlock className="h-4 w-72" />
      </div>

      <div className="rounded-[22px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BillingSkeletonBlock className="size-12 rounded-2xl" />
            <div className="space-y-2">
              <BillingSkeletonBlock className="h-5 w-44" />
              <BillingSkeletonBlock className="h-4 w-32" />
            </div>
          </div>
          <BillingSkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <BillingSkeletonBlock className="h-4 w-28" />
            <div className="grid gap-3 sm:grid-cols-3">
              <BillingSkeletonBlock className="h-24 rounded-2xl" />
              <BillingSkeletonBlock className="h-24 rounded-2xl" />
              <BillingSkeletonBlock className="h-24 rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <BillingSkeletonBlock className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, index) => (
              <BillingSkeletonBlock key={index} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <BillingSkeletonBlock className="h-4 w-32" />
          <div className="grid gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <BillingSkeletonBlock key={index} className="h-72 rounded-[22px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
