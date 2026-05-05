import { Card, CardContent } from "@/components/ui/card"

export default function VendorContractsLoading() {
  return (
    <div className="space-y-6">
      <Card className="border-border/70 py-0 shadow-sm">
        <CardContent className="space-y-4 px-6 py-6">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <Card className="border-border/70 py-0 shadow-sm">
          <CardContent className="space-y-4 px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-20 animate-pulse rounded-2xl bg-muted" />
              <div className="h-20 animate-pulse rounded-2xl bg-muted" />
            </div>
            <div className="h-[520px] animate-pulse rounded-[24px] bg-muted" />
          </CardContent>
        </Card>

        <Card className="border-border/70 py-0 shadow-sm">
          <CardContent className="space-y-4 px-6 py-6">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
