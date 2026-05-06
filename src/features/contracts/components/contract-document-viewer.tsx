"use client"

import { useMemo } from "react"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"
import { cn } from "@/lib/utils"

export type ContractDocumentMeta = {
  vendorName?: string | null
  clientName?: string | null
  reference?: string | null
  amount?: number | null
  depositAmount?: number | null
  currency?: string | null
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (!amount) return null
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "EUR",
    }).format(amount / 100)
  } catch {
    return `${currency ?? "EUR"} ${(amount / 100).toFixed(2)}`
  }
}

function DocumentHeader({ meta }: { meta: ContractDocumentMeta }) {
  const formattedAmount = formatMoney(meta.amount, meta.currency)
  const formattedDeposit = formatMoney(meta.depositAmount, meta.currency)

  return (
    <div className="mb-7 border-b border-slate-200 pb-6">
      {/* Badge + reference */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="inline-flex items-center rounded-sm border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Agreement
        </div>
        {meta.reference && (
          <span className="font-mono text-[11px] text-slate-400">
            {meta.reference}
          </span>
        )}
      </div>

      {/* Parties table */}
      <div className="space-y-2">
        {meta.vendorName && (
          <div className="grid grid-cols-[140px_1fr] items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Service provider
            </span>
            <span className="text-sm font-semibold text-slate-800">{meta.vendorName}</span>
          </div>
        )}
        {meta.clientName && (
          <div className="grid grid-cols-[140px_1fr] items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Client
            </span>
            <span className="text-sm font-semibold text-slate-800">{meta.clientName}</span>
          </div>
        )}
        {(formattedAmount || formattedDeposit) && (
          <div className="mt-3 flex flex-wrap gap-4 pt-1">
            {formattedAmount && (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Total amount
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{formattedAmount}</p>
              </div>
            )}
            {formattedDeposit && (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Deposit
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{formattedDeposit}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SignaturePlaceholder() {
  return (
    <div className="mt-10 border-t border-slate-200 pt-7">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Electronic signature
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="h-14 rounded border border-dashed border-slate-300 bg-slate-50" />
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>Client signature</span>
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Signer</span>
            <span className="text-slate-500">—</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Date</span>
            <span className="text-slate-500">—</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Method</span>
            <span className="text-slate-500">Electronic</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        This document will be electronically signed and a signed PDF artifact will be generated
        upon completion.
      </p>
    </div>
  )
}

export function ContractDocumentViewer({
  html,
  layout = "flow",
  className,
  sampleMode = false,
  documentMeta,
}: {
  html: string
  layout?: "flow" | "paged"
  className?: string
  sampleMode?: boolean
  documentMeta?: ContractDocumentMeta
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
              {documentMeta && <DocumentHeader meta={documentMeta} />}
              <div
                className="contract-document"
                dangerouslySetInnerHTML={{ __html: normalizedHtml }}
              />
              {documentMeta && <SignaturePlaceholder />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
