"use client"

import { motion, useReducedMotion } from "framer-motion"

import { Skeleton } from "@/components/ui/skeleton"

function MotionShell({
  children,
}: {
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  )
}

export function AdminVendorLinksLoadingState() {
  return (
    <MotionShell>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-52 rounded-full" />
              <Skeleton className="h-4 w-80 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="mt-2 h-4 w-60 rounded-full" />
        </div>

        <div className="overflow-hidden">
          <div className="grid grid-cols-8 gap-4 border-b border-border bg-muted/30 px-4 py-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-3 rounded-full" />
            ))}
          </div>

          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="grid grid-cols-8 gap-4 border-b border-border/70 px-4 py-4 last:border-b-0">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="col-span-2 h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </MotionShell>
  )
}

export function AdminVendorLinkDetailLoadingState() {
  return (
    <MotionShell>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-8 w-72 rounded-full" />
        <Skeleton className="h-4 w-48 rounded-full" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-7 w-64 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.2rem_minmax(0,1fr)] gap-4">
            <div className="flex flex-col items-center">
              <span className="mt-2 size-3 rounded-full border-2 border-[var(--contrazy-teal)] bg-background" />
              {index < 4 ? <span className="mt-2 w-px flex-1 bg-border" /> : null}
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((__, innerIndex) => (
                  <Skeleton key={innerIndex} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </MotionShell>
  )
}
