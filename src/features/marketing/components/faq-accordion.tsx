"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"

import type { FaqItem } from "@/content/site"

type FaqAccordionProps = {
  items: readonly FaqItem[]
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index

        return (
          <div key={item.question} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-foreground"
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <ChevronDown
                className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen ? <p className="px-5 pb-5 text-sm leading-7 text-muted-foreground">{item.answer}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
