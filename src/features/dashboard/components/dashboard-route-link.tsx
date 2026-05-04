"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

type DashboardRouteLinkProps = {
  href: string
  className?: string
  children: ReactNode
  pendingLabel?: ReactNode
}

export function DashboardRouteLink({
  href,
  className,
  children,
  pendingLabel,
}: DashboardRouteLinkProps) {
  const [isPending, setIsPending] = useState(false)

  return (
    <Link
      href={href}
      className={cn(
        "transition-opacity",
        isPending && "pointer-events-none opacity-70",
        className
      )}
      onClick={() => setIsPending(true)}
    >
      {isPending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Link>
  )
}
