import type { TransactionReportType } from "@prisma/client"

type ReportAssetEntry = {
  assetUrl: string
  fileName: string
  mimeType?: string | null
}

type ReportFieldEntry = {
  label: string
  type: "TEXT" | "NUMBER" | "SELECT" | "PHOTO" | "FILE"
  value?: string | null
  priorValue?: string | null
  assets?: ReportAssetEntry[]
}

type GenerateReportArtifactInput = {
  reportType: TransactionReportType
  transactionReference: string
  vendorName: string | null
  clientName: string | null
  submittedAt: Date
  fields: ReportFieldEntry[]
  legacyAssets?: ReportAssetEntry[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isImageAsset(asset: ReportAssetEntry) {
  return (
    asset.mimeType?.startsWith("image/") === true ||
    /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(asset.fileName)
  )
}

function renderAssetCollection(assets: ReportAssetEntry[], emptyMessage: string) {
  if (assets.length === 0) {
    return `<p style="color:#64748b;font-size:13px;">${escapeHtml(emptyMessage)}</p>`
  }

  return `<div style="display:flex;flex-wrap:wrap;gap:12px;">
    ${assets
      .map((asset) =>
        isImageAsset(asset)
          ? `<a href="${escapeHtml(asset.assetUrl)}" style="display:block;width:136px;text-decoration:none;">
              <span style="display:block;overflow:hidden;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
                <img src="${escapeHtml(asset.assetUrl)}" alt="${escapeHtml(asset.fileName)}" style="display:block;width:100%;height:112px;object-fit:cover;" />
              </span>
              <span style="display:block;margin-top:6px;font-size:12px;color:#0f172a;line-height:1.45;">${escapeHtml(asset.fileName)}</span>
            </a>`
          : `<a href="${escapeHtml(asset.assetUrl)}" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#0369a1;text-decoration:none;background:#f8fafc;">
              📎 ${escapeHtml(asset.fileName)}
            </a>`
      )
      .join("")}
  </div>`
}

export function generateReportArtifactHtml(input: GenerateReportArtifactInput) {
  const {
    reportType,
    transactionReference,
    vendorName,
    clientName,
    submittedAt,
    fields,
    legacyAssets = [],
  } = input

  const isCheckOut = reportType === "CHECK_OUT"
  const title = isCheckOut ? "Check-Out Report" : "Check-In Report"
  const accentColor = isCheckOut ? "#be123c" : "#b45309"
  const badgeBg = isCheckOut ? "#fff1f2" : "#fffbeb"

  const scalarFields = fields.filter((field) => field.type !== "PHOTO" && field.type !== "FILE")
  const uploadFields = fields.filter((field) => field.type === "PHOTO" || field.type === "FILE")
  const showComparisonColumn = scalarFields.some((field) => Boolean(field.priorValue))

  const scalarFieldsHtml =
    scalarFields.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Field</th>
              ${
                showComparisonColumn
                  ? '<th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Check-In</th>'
                  : ""
              }
              <th style="text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">${
                isCheckOut ? "Check-Out" : "Value"
              }</th>
            </tr>
          </thead>
          <tbody>
            ${scalarFields
              .map((field, index) => {
                const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc"
                return `<tr style="background:${rowBackground};">
                  <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:500;color:#0f172a;">${escapeHtml(field.label)}</td>
                  ${
                    showComparisonColumn
                      ? `<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">${
                          field.priorValue ? escapeHtml(field.priorValue) : "—"
                        }</td>`
                      : ""
                  }
                  <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:500;">${
                    field.value?.trim() ? escapeHtml(field.value.trim()) : "—"
                  }</td>
                </tr>`
              })
              .join("")}
          </tbody>
        </table>`
      : "<p style='color:#64748b;font-size:13px;'>No scalar fields recorded.</p>"

  const uploadFieldsHtml =
    uploadFields.length > 0
      ? uploadFields
          .map((field) => {
            const assets = field.assets ?? []

            return `<div style="margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(field.label)}</p>
                <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${field.type === "PHOTO" ? "Photos" : "Files"}${assets.length ? ` (${assets.length})` : ""}</span>
              </div>
              <div style="margin-top:10px;">
                ${renderAssetCollection(
                  assets,
                  field.type === "PHOTO" ? "No photos uploaded." : "No files uploaded."
                )}
              </div>
            </div>`
          })
          .join("")
      : "<p style='color:#64748b;font-size:13px;'>No upload fields recorded.</p>"

  const legacyAssetsHtml =
    legacyAssets.length > 0
      ? `<div class="section-title">Additional uploads</div>${renderAssetCollection(
          legacyAssets,
          "No additional uploads."
        )}`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — ${escapeHtml(transactionReference)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; background: #f1f5f9; color: #0f172a; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; max-width: 760px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
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

    <div class="section-title">Recorded fields</div>
    ${scalarFieldsHtml}

    <div class="section-title">Requested uploads</div>
    ${uploadFieldsHtml}

    ${legacyAssetsHtml}
  </div>
</body>
</html>`
}
