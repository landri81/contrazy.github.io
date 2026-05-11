"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "relative flex items-center justify-center px-8 pt-1",
        caption_label: "text-sm font-semibold tracking-tight text-foreground",
        nav: "absolute inset-x-0 top-1 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-7 rounded-xl text-muted-foreground hover:bg-slate-900/[0.05] hover:text-foreground"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-7 rounded-xl text-muted-foreground hover:bg-slate-900/[0.05] hover:text-foreground"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "mb-1 grid grid-cols-7",
        weekday:
          "flex h-9 items-center justify-center text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
        week: "grid grid-cols-7",
        day: "p-0 text-center",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-9 rounded-xl p-0 text-sm font-medium text-foreground hover:bg-slate-900/[0.05] hover:text-foreground"
        ),
        today: "text-[var(--contrazy-teal)]",
        selected:
          "bg-[var(--contrazy-teal)] text-white shadow-[0_10px_24px_-18px_rgba(17,201,176,0.85)] hover:bg-[#0eb8a0] hover:text-white focus:bg-[#0eb8a0] focus:text-white",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/30 opacity-100",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("size-4", iconClassName)} {...iconProps} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
