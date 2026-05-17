import { getTranslations } from "next-intl/server"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"

type SignedAgreementPreviewProps = {
  title?: string | null
  vendorName: string
  clientName: string
  clientEmail: string
  transactionReference: string
  amount?: number | null
  depositAmount?: number | null
  currency?: string | null
  signedAtLabel: string
  signatureMethod: string
  ipAddress?: string | null
  signatureImageUrl?: string | null
  vendorLogoUrl?: string | null
  presentation?: "framed" | "plain"
  renderedHtml: string
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

function VendorBrand({
  vendorName,
  vendorLogoUrl,
}: {
  vendorName: string
  vendorLogoUrl?: string | null
}) {
  const displayName = vendorName.trim() || "Vendor"

  if (vendorLogoUrl) {
    return (
      <div className="inline-flex min-h-10 items-center gap-3" aria-label={displayName}>
        <div className="flex min-h-10 items-center">
          <img
            src={vendorLogoUrl}
            alt={displayName}
            className="max-h-10 max-w-[140px] object-contain object-left"
          />
        </div>
        <span className="max-w-[220px] text-sm font-semibold tracking-tight text-slate-950">
          {displayName}
        </span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2" aria-label={displayName}>
      <div className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {displayName.slice(0, 2).toUpperCase() || "VD"}
      </div>
      <span className="font-sans text-[0.98rem] font-semibold tracking-tight text-slate-950">
        {displayName}
      </span>
    </div>
  )
}

export async function SignedAgreementPreview({
  title,
  vendorName,
  clientName,
  clientEmail,
  transactionReference,
  amount,
  depositAmount,
  currency,
  signedAtLabel,
  signatureMethod,
  ipAddress,
  signatureImageUrl,
  vendorLogoUrl = null,
  presentation = "framed",
  renderedHtml,
}: SignedAgreementPreviewProps) {
  const t = await getTranslations("contracts.preview")
  const contractsT = await getTranslations("contracts")
  const normalizedHtml = normalizeContractTemplateMarkup(renderedHtml)

  const serviceAmountLabel = formatMoney(amount, currency)
  const depositAmountLabel = formatMoney(depositAmount, currency)

  const content = (
    <>

              {/* ── HEADER ─────────────────────────────────────────────────── */}
              <header className="mb-5">
                {/* Top bar: logo left · title right */}
                <div className="flex items-end justify-between border-b border-slate-200 pb-3">
                  <VendorBrand vendorName={vendorName} vendorLogoUrl={vendorLogoUrl} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t("signedAgreement")}
                  </p>
                </div>

                {/* Document title + table side by side */}
                <div className="mt-3 flex flex-col gap-0.5 mb-3">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900 leading-snug">
                    {title?.trim() || t("finalAgreement")}
                  </h1>
                  <p className="text-xs text-slate-400">
                    {t("electronicallyExecuted")}
                  </p>
                </div>

                {/* ── Formal details table ── */}
                <table className="w-full border-collapse">
                  <tbody>
                    <TableRow label={t("serviceProvider")} value={vendorName} />
                    <TableRow label={t("client")} value={clientName} />
                    <TableRow label={t("signed")} value={signedAtLabel} />
                    <TableRow label={t("reference")} value={transactionReference} mono />
                    {serviceAmountLabel && (
                      <TableRow label={t("serviceAmount")} value={serviceAmountLabel} />
                    )}
                    {depositAmountLabel && (
                      <TableRow label={t("deposit")} value={depositAmountLabel} />
                    )}
                  </tbody>
                </table>
              </header>

              {/* ── BODY ───────────────────────────────────────────────────── */}
              <div
                className="contract-document"
                dangerouslySetInnerHTML={{ __html: normalizedHtml }}
              />

              {/* ── SIGNATURE SECTION ──────────────────────────────────────── */}
              <section className="mt-6 pt-5 border-t border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 mb-3">
                  {t("electronicSignature")}
                </p>

                <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
                  {/* Signature image */}
                  <div>
                    <div className="flex h-36 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3">
                      {signatureImageUrl ? (
                        <img
                          src={signatureImageUrl}
                          alt="Signature"
                          className="max-h-28 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">{t("unavailable")}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-slate-700">{clientName}</p>
                  </div>

                  {/* Audit details */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                      <AuditRow label={t("name")}      value={clientName} />
                      <AuditRow label={t("email")}     value={clientEmail} />
                      <AuditRow label={t("method")}    value={signatureMethod} />
                      <AuditRow label={t("signedAt")} value={signedAtLabel} />
                      {ipAddress && <AuditRow label={t("ip")} value={ipAddress} mono />}
                    </dl>
                  </div>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  {t("auditFooter")}
                </p>
              </section>

              {/* ── FOOTER ─────────────────────────────────────────────────── */}
              <footer className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3">
                <div className="inline-flex items-center gap-2" aria-label="Contrazy">
                  <img
                    src="/logo/favicon-contrazy-64.png"
                    alt="Contrazy"
                    width={16}
                    height={16}
                    className="size-4 opacity-75"
                  />
                  <span className="font-sans text-[0.78rem] font-semibold tracking-tight text-slate-400">
                    {contractsT("preview.footerCredit")}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-slate-400">
                  {transactionReference} · contrazy.com
                </p>
              </footer>
    </>
  )

  if (presentation === "plain") {
    return (
      <article className="w-full bg-white">
        <div className="px-0 py-0">
          {content}
        </div>
      </article>
    )
  }

  return (
    <div className="contract-document-viewer contract-document-viewer--paged w-full">
      <div className="contract-document-page-stack">
        <div className="contract-document-page-frame">
          <article className="contract-document-page">
            <div className="contract-document-page__content">
              {content}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableRow({
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
      <td className="py-1.5 pr-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 align-middle whitespace-nowrap w-36">
        {label}
      </td>
      <td className={`py-1.5 text-[13px] text-slate-800 font-medium ${mono ? "font-mono text-slate-600" : ""}`}>
        {value}
      </td>
    </tr>
  )
}

function AuditRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 self-center whitespace-nowrap">
        {label}
      </dt>
      <dd className={`text-[12px] text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </>
  )
}
