import { CheckCircle2, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function MarketingPageSkeleton() {
  return (
    <div className="min-h-screen bg-background px-5 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-36 rounded-full" />
          <div className="hidden gap-3 md:flex">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-5">
            <Skeleton className="h-9 w-40 rounded-full" />
            <Skeleton className="h-16 w-full max-w-3xl rounded-2xl" />
            <Skeleton className="h-16 w-full max-w-2xl rounded-2xl" />
            <Skeleton className="h-5 w-full max-w-xl rounded-full" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-11 w-44 rounded-full" />
              <Skeleton className="h-11 w-40 rounded-full" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-border/70 bg-card/70">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-10 w-20 rounded-xl" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuthPageSkeleton() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[470px_1fr]">
      <aside className="relative hidden overflow-hidden bg-[var(--contrazy-navy)] px-10 py-12 lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full bg-white/10" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full max-w-xs rounded-2xl bg-white/10" />
            <Skeleton className="h-12 w-full max-w-sm rounded-2xl bg-white/10" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/70">
                  <CheckCircle2 className="size-4" />
                </div>
                <Skeleton className="h-4 w-64 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-4 w-48 rounded-full bg-white/10" />
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-10 w-52 rounded-2xl" />
            <Skeleton className="h-5 w-full rounded-full" />
          </div>
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-11 w-full rounded-xl" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-px flex-1 rounded-full" />
                <Skeleton className="h-3 w-10 rounded-full" />
                <Skeleton className="h-px flex-1 rounded-full" />
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
      <header className="border-b border-white/10 bg-[var(--contrazy-navy)] px-4 py-3 text-white lg:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10">
              <LayoutDashboard className="size-5" />
            </div>
            <Skeleton className="h-7 w-36 rounded-full bg-white/10" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full bg-white/10" />
        </div>
      </header>
      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background p-4 lg:block">
          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div key={sectionIndex} className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <Skeleton key={itemIndex} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-10 w-80 rounded-2xl" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="border-border/70 bg-card/85">
                  <CardContent className="space-y-3 p-6">
                    <Skeleton className="h-4 w-28 rounded-full" />
                    <Skeleton className="h-9 w-24 rounded-xl" />
                    <Skeleton className="h-4 w-full rounded-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-border/70 bg-card/85">
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-72 w-full rounded-2xl" />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

export function ClientFlowSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
      <header className="border-b border-border bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-navy)] text-white">
              <Sparkles className="size-4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-5 w-40 rounded-full" />
            </div>
          </div>
          <div className="hidden space-y-2 sm:block">
            <Skeleton className="ml-auto h-3 w-20 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        <div className="space-y-4">
          <Skeleton className="h-1 w-full rounded-full" />
          <div className="flex justify-between gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex min-w-12 flex-col items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <Card className="mt-8 border-border/70 bg-card/90 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-8 w-44 rounded-2xl" />
            <Skeleton className="h-5 w-full rounded-full" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
