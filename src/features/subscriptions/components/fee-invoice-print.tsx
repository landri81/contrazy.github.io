// Server component – no client state needed

import { CONTRAZY_COMPANY } from "@/lib/config/contrazy-company"

function formatCents(amount: number, currency: string, locale: string) {
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB"
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
  }
}

export type FeeInvoicePrintLabels = {
  title: string
  invoiceNumber: string
  issueDate: string
  issuedBy: string
  billedTo: string
  vatNumber: string
  registrationNumber: string
  transaction: string
  reference: string
  transactionTitle: string
  client: string
  operation: string
  operationDate: string
  chargesSection: string
  contrazyFeeInclVat: string
  contrazyFeeExclVat: string
  vatLine: string
  totalDue: string
  stripeSeparateNote: string
  footerNote: string
}

export type FeeInvoicePrintData = {
  invoiceNumber: string
  issueDateFormatted: string
  vendorName: string
  vendorEmail: string | null
  vendorAddress: string | null
  vendorVatNumber: string | null
  clientName: string | null
  transactionReference: string
  transactionTitle: string
  kindLabel: string
  processedAtFormatted: string
  /** platformFeeAmount as stored — VAT-inclusive (TTC) */
  contrazyFeeInclVat: number
  /** round(TTC / 1.20) — VAT-exclusive (HT) */
  contrazyFeeExclVat: number
  /** TTC - HT */
  vatAmount: number
  currency: string
  locale: string
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        padding: "6px 0",
        fontSize: "12px",
        borderBottom: "1px solid #f0f2f5",
      }}
    >
      <span style={{ color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#111827", textAlign: "right" }}>{value}</span>
    </div>
  )
}

export function FeeInvoicePrint({
  data,
  labels,
}: {
  data: FeeInvoicePrintData
  labels: FeeInvoicePrintLabels
}) {
  const fmt = (amount: number) => formatCents(amount, data.currency, data.locale)

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #ffffff; }
      `}</style>

      <div
        style={{
          width: "794px",
          minHeight: "1123px",
          background: "#ffffff",
          padding: "48px 56px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#111827",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            paddingBottom: "24px",
            borderBottom: "1px solid #e5e7eb",
            marginBottom: "32px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo-contrazy-dark.png"
            alt="Contrazy"
            style={{ height: "28px", width: "auto", display: "block" }}
          />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#0C1E2F", lineHeight: 1.2 }}>
              {labels.title}
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6b7280",
                letterSpacing: "0.05em",
                marginTop: "6px",
              }}
            >
              {data.invoiceNumber}
            </div>
            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
              {labels.issueDate}: {data.issueDateFormatted}
            </div>
          </div>
        </div>

        {/* ── Issued by / Billed to ───────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "32px",
            marginBottom: "32px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9ca3af",
                marginBottom: "8px",
              }}
            >
              {labels.issuedBy}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0C1E2F" }}>{CONTRAZY_COMPANY.name}</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              {CONTRAZY_COMPANY.email}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", whiteSpace: "pre-line" }}>
              {CONTRAZY_COMPANY.address}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              {labels.vatNumber}: {CONTRAZY_COMPANY.vatNumber}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              {labels.registrationNumber}: {CONTRAZY_COMPANY.registrationNumber}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9ca3af",
                marginBottom: "8px",
              }}
            >
              {labels.billedTo}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0C1E2F" }}>
              {data.vendorName || "—"}
            </div>
            {data.vendorEmail && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {data.vendorEmail}
              </div>
            )}
            {data.vendorAddress && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", whiteSpace: "pre-line" }}>
                {data.vendorAddress}
              </div>
            )}
            {data.vendorVatNumber && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {labels.vatNumber}: {data.vendorVatNumber}
              </div>
            )}
          </div>
        </div>

        {/* ── Transaction details ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: "8px",
            }}
          >
            {labels.transaction}
          </div>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "4px 16px",
            }}
          >
            <DetailRow label={labels.reference} value={data.transactionReference} />
            <DetailRow label={labels.transactionTitle} value={data.transactionTitle} />
            {data.clientName && <DetailRow label={labels.client} value={data.clientName} />}
            <DetailRow label={labels.operation} value={data.kindLabel} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                padding: "6px 0",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "#6b7280", flexShrink: 0 }}>{labels.operationDate}</span>
              <span style={{ fontWeight: 600, color: "#111827", textAlign: "right" }}>
                {data.processedAtFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* ── Contrazy charges with VAT ───────────────────────────────────────── */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: "8px",
            }}
          >
            {labels.chargesSection}
          </div>
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "4px 16px 12px",
            }}
          >
            {/* Contrazy fee incl. VAT (TTC) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: "12px",
                borderBottom: "1px solid #f0f2f5",
                color: "#111827",
                fontWeight: 600,
              }}
            >
              <span>{labels.contrazyFeeInclVat}</span>
              <span>{fmt(data.contrazyFeeInclVat)}</span>
            </div>

            {/* Contrazy fee excl. VAT (HT) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: "12px",
                borderBottom: "1px solid #f0f2f5",
                color: "#6b7280",
              }}
            >
              <span>{labels.contrazyFeeExclVat}</span>
              <span>{fmt(data.contrazyFeeExclVat)}</span>
            </div>

            {/* VAT line */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              <span>{labels.vatLine}</span>
              <span>{fmt(data.vatAmount)}</span>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "2px solid #e5e7eb", margin: "10px 0 4px" }} />

            {/* Total due */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                fontSize: "14px",
                fontWeight: 800,
                color: "#0C1E2F",
              }}
            >
              <span>{labels.totalDue}</span>
              <span style={{ color: "#11C9B1" }}>{fmt(data.contrazyFeeInclVat)}</span>
            </div>
          </div>
        </div>

        {/* ── Stripe separate note ────────────────────────────────────────────── */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "11px",
            color: "#92400e",
            marginBottom: "32px",
            lineHeight: 1.5,
          }}
        >
          {labels.stripeSeparateNote}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: "16px",
            fontSize: "10px",
            color: "#9ca3af",
            lineHeight: 1.6,
          }}
        >
          {labels.footerNote}
        </div>
      </div>
    </>
  )
}
