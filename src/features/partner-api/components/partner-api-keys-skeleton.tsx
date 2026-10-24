import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PartnerApiKeyRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="hidden h-5 w-32 rounded-full md:block" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function PartnerApiKeysSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="size-11 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-full rounded-lg sm:w-40" />
          </div>
          <Skeleton className="h-16 w-full rounded-2xl" />
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <PartnerApiKeyRowsSkeleton />
      </Card>
    </div>
  )
}
