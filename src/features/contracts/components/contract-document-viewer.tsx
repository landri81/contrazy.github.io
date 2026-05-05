"use client"

import { useMemo } from "react"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"
import { cn } from "@/lib/utils"

export function ContractDocumentViewer({
  html,
  layout = "flow",
  className,
  sampleMode = false,
}: {
  html: string
  layout?: "flow" | "paged"
  className?: string
  sampleMode?: boolean
}) {
  const normalizedHtml = useMemo(() => normalizeContractTemplateMarkup(html), [html])

  if (layout === "flow") {
    return (
      <div
        className={cn("contract-document", className)}
        dangerouslySetInnerHTML={{ __html: normalizedHtml }}
      />
    )
  }

  return (
    <div
      className={cn("contract-document-viewer contract-document-viewer--paged w-full", className)}
      data-sample-mode={sampleMode ? "true" : "false"}
    >
      <div className="contract-document-page-stack">
        <div className="contract-document-page-frame">
          <div className="contract-document-page">
            <div className="contract-document-page__content">
              <div
                className="contract-document"
                dangerouslySetInnerHTML={{ __html: normalizedHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
