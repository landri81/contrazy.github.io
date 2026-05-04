import { cn } from "@/lib/utils"

export function CharacterCount({
  current,
  limit,
  className,
}: {
  current: number
  limit: number
  className?: string
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {current} / {limit}
    </p>
  )
}
