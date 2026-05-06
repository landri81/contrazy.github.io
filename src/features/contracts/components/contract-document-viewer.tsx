"use client"

import { useMemo } from "react"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"
import { cn } from "@/lib/utils"

export type ContractDocumentMeta = {
  title?: string | null
  vendorName?: string | null
  clientName?: string | null
  reference?: string | null
  amount?: number | null
  depositAmount?: number | null
  currency?: string | null
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return null
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "EUR",
    }).format(amount / 100)
  } catch {
    return `${currency ?? "EUR"} ${(amount / 100).toFixed(2)}`
  }
}

function ContrazyWordmark() {
  return (
    <div className="inline-flex items-center gap-2" aria-label="Contrazy">
      <img
        src="/logo/favicon-contrazy-64.png"
        alt="Contrazy"
        width={24}
        height={24}
        className="size-6"
      />
      <span className="font-sans text-[1.05rem] font-extrabold tracking-tight text-slate-950">
        Con<span className="text-(--contrazy-teal)">trazy</span>
      </span>
    </div>
  )
}

function DocumentHeader({ meta }: { meta: ContractDocumentMeta }) {
  const formattedAmount = formatMoney(meta.amount, meta.currency)
  const formattedDeposit = formatMoney(meta.depositAmount, meta.currency)

  return (
    <header className="mb-5">
      <div className="flex items-end justify-between border-b border-slate-200 pb-3">
        <ContrazyWordmark />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Agreement Review
        </p>
      </div>

      <div className="mb-3 mt-3 flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">
          {meta.title?.trim() || "Agreement"}
        </h1>
        <p className="text-xs text-slate-400">
          Review copy - locked transaction snapshot
        </p>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          {meta.vendorName && <DocumentHeaderRow label="Service Provider" value={meta.vendorName} />}
          {meta.clientName && <DocumentHeaderRow label="Client" value={meta.clientName} />}
          {meta.reference && <DocumentHeaderRow label="Reference" value={meta.reference} mono />}
          {formattedAmount && (
            <DocumentHeaderRow label="Service Amount" value={formattedAmount} />
          )}
          {formattedDeposit && (
            <DocumentHeaderRow label="Deposit" value={formattedDeposit} />
          )}
        </tbody>
      </table>
    </header>
  )
}

function DocumentHeaderRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="w-36 whitespace-nowrap py-1.5 pr-6 align-middle text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </td>
      <td className={cn("py-1.5 text-[13px] font-medium text-slate-800", mono && "font-mono text-slate-600")}>
        {value}
      </td>
    </tr>
  )
}

function ReviewFooter({ reference }: { reference?: string | null }) {
  return (
    <footer className="mt-8 flex items-center justify-between border-t border-slate-200 pt-3">
      <div className="inline-flex items-center gap-2" aria-label="Contrazy">
        <img
          src="/logo/favicon-contrazy-64.png"
          alt="Contrazy"
          width={16}
          height={16}
          className="size-4 opacity-75"
        />
        <span className="font-sans text-[0.78rem] font-extrabold tracking-tight text-slate-400">
          Con<span className="text-(--contrazy-teal) opacity-80">trazy</span>
        </span>
      </div>
      {reference ? (
        <p className="font-mono text-[10px] text-slate-400">
          {reference} - contrazy.com
        </p>
      ) : null}
    </footer>
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
              <ReviewFooter reference={documentMeta?.reference} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
