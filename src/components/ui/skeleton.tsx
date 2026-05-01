import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-[linear-gradient(110deg,rgba(148,163,184,0.10),rgba(148,163,184,0.22),rgba(148,163,184,0.10))] bg-[length:220%_100%] animate-[skeleton-shimmer_1.8s_linear_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
