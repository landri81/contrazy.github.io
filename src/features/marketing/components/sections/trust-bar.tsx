"use client"

import { Stagger, StaggerItem } from "@/components/ui/motion"
import { useTranslations } from "next-intl"

export function TrustBar() {
  const t = useTranslations("marketing.trustBar")
  const signals = t.raw("signals") as string[]

  return (
    <div className="border-b border-border bg-background px-5 py-6 lg:px-10">
      <Stagger
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3"
        staggerChildren={0.06}
      >
        {signals.map((signal) => (
          <StaggerItem
            key={signal}
            y={6}
            className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
          >
            <span className="size-[7px] shrink-0 rounded-full bg-[var(--contrazy-teal)]" />
            {signal}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
