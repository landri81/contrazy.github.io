import type { TransactionReportType } from "@prisma/client"

type ReportFieldEntry = {
  label: string
  value: string
}

type PriorEntry = {
  label: string
  priorValue: string
  currentValue: string
}

type ReportAssetEntry = {
  assetUrl: string
  fileName: string
}

type GenerateReportArtifactInput = {
  reportType: TransactionReportType
  transactionReference: string
  vendorName: string | null
  clientName: string | null
  submittedAt: Date
  fields: ReportFieldEntry[]
  assets: ReportAssetEntry[]
  comparisonFields?: PriorEntry[]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function generateReportArtifactHtml(input: GenerateReportArtifactInput): string {
  const { reportType, transactionReference, vendorName, clientName, submittedAt, fields, assets, comparisonFields } = input

  const isCheckOut = reportType === "CHECK_OUT"
  const title = isCheckOut ? "Check-Out Report" : "Check-In Report"
  const accentColor = isCheckOut ? "#be123c" : "#b45309"
  const badgeBg = isCheckOut ? "#fff1f2" : "#fffbeb"

  const fieldsHtml = fields.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Field</th>
            ${isCheckOut && comparisonFields && comparisonFields.length > 0 ? '<th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Check-In</th>' : ""}
            <th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">${isCheckOut ? "Check-Out" : "Value"}</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map((f, i) => {
            const priorEntry = comparisonFields?.find((c) => c.label === f.label)
            const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc"
            return `<tr style="background:${rowBg};">
              <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:500;color:#0f172a;">${escapeHtml(f.label)}</td>
              ${isCheckOut && priorEntry ? `<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">${escapeHtml(priorEntry.priorValue)}</td>` : ""}
              <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500;">${escapeHtml(f.value)}</td>
            </tr>`
          }).join("")}
        </tbody>
      </table>`
    : "<p style='color:#64748b;font-size:13px;'>No fields recorded.</p>"

  const assetsHtml = assets.length > 0
    ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
        ${assets.map((a) => `<a href="${escapeHtml(a.assetUrl)}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#0ea5e9;text-decoration:none;background:#f0f9ff;">📷 ${escapeHtml(a.fileName)}</a>`).join("")}
      </div>`
    : "<p style='color:#64748b;font-size:13px;'>No photos uploaded.</p>"

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — ${escapeHtml(transactionReference)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; background: #f1f5f9; color: #0f172a; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; max-width: 720px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .badge { display:inline-block; padding: 3px 10px; border-radius: 9999px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:${badgeBg}; color:${accentColor}; border:1px solid ${accentColor}40; margin-bottom: 12px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#64748b; margin-bottom:10px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px; }
    .section-title:first-of-type { border-top:none; padding-top:0; margin-top:0; }
    @media print { body { padding: 0; background: white; } .card { box-shadow: none; padding: 16px; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${title}</div>
    <h1>${title}</h1>
    <div class="meta">
      <span>Reference: <strong>${escapeHtml(transactionReference)}</strong></span>
      ${vendorName ? `<span>Vendor: <strong>${escapeHtml(vendorName)}</strong></span>` : ""}
      ${clientName ? `<span>Client: <strong>${escapeHtml(clientName)}</strong></span>` : ""}
      <span>Submitted: <strong>${submittedAt.toISOString()}</strong></span>
    </div>

    <div class="section-title">Recorded Fields</div>
    ${fieldsHtml}

    <div class="section-title">Photos</div>
    ${assetsHtml}
  </div>
</body>
</html>`
}
