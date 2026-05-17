import "server-only"

import { readFile } from "fs/promises"
import { join } from "path"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeeInvoicePayment = {
  id: string
  amount: number
  currency: string
  stripeFeeAmount: number | null
  platformFeeAmount: number | null
  vendorNetAmount: number | null
  kind: string
  status: string
  processedAt: Date | null
  createdAt: Date
  transaction: {
    reference: string
    title: string
    clientProfile: { fullName: string } | null
  }
}

export type FeeInvoiceVendorProfile = {
  businessName: string | null
  businessAddress: string | null
  vatNumber: string | null
  businessEmail: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 50
const MARGIN_TOP = 50
const CONTENT_W = PAGE_W - MARGIN_X * 2

const BRAND_ICON_PATH = join(process.cwd(), "public", "logo", "favicon-contrazy-64.png")

const PDF_COLORS = {
  text: rgb(0.09, 0.12, 0.16),
  textSoft: rgb(0.35, 0.4, 0.46),
  textMuted: rgb(0.58, 0.62, 0.68),
  border: rgb(0.88, 0.9, 0.93),
  panel: rgb(0.973, 0.979, 0.987),
  teal: rgb(0.067, 0.788, 0.69),
  navy: rgb(0.047, 0.118, 0.184),
  white: rgb(1, 1, 1),
} as const

// ── i18n labels ───────────────────────────────────────────────────────────────

type Locale = "en" | "fr"

type InvoiceLabels = {
  title: string
  invoiceNumber: string
  issueDate: string
  vendor: string
  vatNumber: string
  transactionSection: string
  reference: string
  transactionTitle: string
  client: string
  operation: string
  operationDate: string
  feeSection: string
  grossAmount: string
  stripeFee: string
  contrazyFee: string
  totalFees: string
  vendorNet: string
  footer: string
  kinds: Record<string, string>
}

const LABELS: Record<Locale, InvoiceLabels> = {
  en: {
    title: "Fee Invoice",
    invoiceNumber: "Invoice number",
    issueDate: "Issue date",
    vendor: "Vendor",
    vatNumber: "VAT number",
    transactionSection: "Transaction details",
    reference: "Reference",
    transactionTitle: "Title",
    client: "Client",
    operation: "Operation type",
    operationDate: "Operation date",
    feeSection: "Fee breakdown",
    grossAmount: "Gross amount",
    stripeFee: "Stripe fee",
    contrazyFee: "Contrazy fee",
    totalFees: "Total fees",
    vendorNet: "Vendor net",
    footer:
      "This document is a transaction fee receipt issued by Contrazy. It is not a tax invoice. Please consult your accountant for VAT treatment.",
    kinds: {
      SERVICE_PAYMENT: "Service payment",
      DEPOSIT_AUTHORIZATION: "Deposit hold",
      DEPOSIT_CAPTURE: "Deposit capture",
      DEPOSIT_RELEASE: "Deposit release",
    },
  },
  fr: {
    title: "Facture de frais",
    invoiceNumber: "Numéro de facture",
    issueDate: "Date d'émission",
    vendor: "Vendeur",
    vatNumber: "Numéro TVA",
    transactionSection: "Détails de la transaction",
    reference: "Référence",
    transactionTitle: "Titre",
    client: "Client",
    operation: "Type d'opération",
    operationDate: "Date d'opération",
    feeSection: "Détail des frais",
    grossAmount: "Montant brut",
    stripeFee: "Frais Stripe",
    contrazyFee: "Frais Contrazy",
    totalFees: "Total des frais",
    vendorNet: "Net vendeur",
    footer:
      "Ce document est un reçu de frais de transaction émis par Contrazy. Il ne constitue pas une facture fiscale. Veuillez consulter votre comptable pour le traitement de la TVA.",
    kinds: {
      SERVICE_PAYMENT: "Paiement de service",
      DEPOSIT_AUTHORIZATION: "Blocage de dépôt",
      DEPOSIT_CAPTURE: "Capture de dépôt",
      DEPOSIT_RELEASE: "Libération de dépôt",
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
  }
}

function formatDate(date: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!text.trim()) return [""]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    try {
      if (font.widthOfTextAtSize(candidate, size) > maxW) {
        if (current) lines.push(current)
        if (font.widthOfTextAtSize(word, size) > maxW) {
          let chunk = ""
          for (const ch of word) {
            const next = chunk + ch
            if (font.widthOfTextAtSize(next, size) > maxW) {
              if (chunk) lines.push(chunk)
              chunk = ch
            } else {
              chunk = next
            }
          }
          current = chunk
        } else {
          current = word
        }
      } else {
        current = candidate
      }
    } catch {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number
    y: number
    font: PDFFont
    size: number
    color: ReturnType<typeof rgb>
    maxWidth?: number
  }
): number {
  if (!options.maxWidth) {
    page.drawText(text, {
      x: options.x,
      y: options.y,
      font: options.font,
      size: options.size,
      color: options.color,
    })
    return options.size * 1.4
  }

  const lines = wrapText(text, options.font, options.size, options.maxWidth)
  const lineH = options.size * 1.4

  lines.forEach((line, i) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - i * lineH,
      font: options.font,
      size: options.size,
      color: options.color,
    })
  })

  return lines.length * lineH
}

async function embedBrandIcon(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(BRAND_ICON_PATH)
    return await pdf.embedPng(bytes)
  } catch {
    return null
  }
}

function drawDivider(page: PDFPage, y: number, strong = false) {
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_W - MARGIN_X, y },
    thickness: strong ? 1.2 : 0.6,
    color: PDF_COLORS.border,
  })
}

function drawSectionHeader(page: PDFPage, label: string, y: number, font: PDFFont): number {
  const panelH = 22
  page.drawRectangle({
    x: MARGIN_X,
    y: y - panelH,
    width: CONTENT_W,
    height: panelH,
    color: PDF_COLORS.panel,
    borderColor: PDF_COLORS.border,
    borderWidth: 0.6,
  })
  page.drawText(label.toUpperCase(), {
    x: MARGIN_X + 10,
    y: y - 15,
    font,
    size: 7.5,
    color: PDF_COLORS.textMuted,
  })
  return y - panelH
}

function drawLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  fonts: { label: PDFFont; value: PDFFont },
  labelWidth = 130
): number {
  const valueX = MARGIN_X + labelWidth + 16
  const valueWidth = CONTENT_W - labelWidth - 16

  page.drawText(label, {
    x: MARGIN_X,
    y: y - 14,
    font: fonts.label,
    size: 8,
    color: PDF_COLORS.textMuted,
  })

  const h = drawText(page, value, {
    x: valueX,
    y: y - 14,
    font: fonts.value,
    size: 11,
    color: PDF_COLORS.text,
    maxWidth: valueWidth,
  })

  const rowH = Math.max(22, h + 8)

  page.drawLine({
    start: { x: MARGIN_X, y: y - rowH },
    end: { x: PAGE_W - MARGIN_X, y: y - rowH },
    thickness: 0.5,
    color: PDF_COLORS.border,
  })

  return y - rowH
}

function drawFeeRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  fonts: { label: PDFFont; value: PDFFont },
  bold = false
): number {
  const rowH = 22
  if (bold) {
    page.drawRectangle({
      x: MARGIN_X,
      y: y - rowH,
      width: CONTENT_W,
      height: rowH,
      color: PDF_COLORS.panel,
    })
  }

  page.drawText(label, {
    x: MARGIN_X + 8,
    y: y - 14,
    font: bold ? fonts.value : fonts.label,
    size: bold ? 11 : 10,
    color: bold ? PDF_COLORS.text : PDF_COLORS.textSoft,
  })

  const valueStr = value
  const valueW = (bold ? fonts.value : fonts.label).widthOfTextAtSize(valueStr, bold ? 11 : 10)

  page.drawText(valueStr, {
    x: PAGE_W - MARGIN_X - valueW - 8,
    y: y - 14,
    font: bold ? fonts.value : fonts.label,
    size: bold ? 11 : 10,
    color: bold ? PDF_COLORS.text : PDF_COLORS.textSoft,
  })

  page.drawLine({
    start: { x: MARGIN_X, y: y - rowH },
    end: { x: PAGE_W - MARGIN_X, y: y - rowH },
    thickness: 0.4,
    color: PDF_COLORS.border,
  })

  return y - rowH
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateFeeInvoicePdf(params: {
  payment: FeeInvoicePayment
  vendorProfile: FeeInvoiceVendorProfile
  locale: Locale
  invoiceNumber: string
}): Promise<Buffer> {
  const { payment, vendorProfile, locale, invoiceNumber } = params
  const labels = LABELS[locale]
  const kindLabels = labels.kinds

  const processedAt = payment.processedAt ?? payment.createdAt
  const stripeFee = payment.stripeFeeAmount ?? 0
  const contrazyFee = payment.platformFeeAmount ?? 0
  const totalFees = stripeFee + contrazyFee
  const vendorNet = payment.vendorNetAmount ?? Math.max(0, payment.amount - totalFees)
  const currency = payment.currency
  const kindLabel = kindLabels[payment.kind] ?? payment.kind

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PAGE_W, PAGE_H])

  const [fontRegular, fontBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ])
  const brandIcon = await embedBrandIcon(pdf)

  const fonts = { label: fontRegular, value: fontRegular, bold: fontBold }

  let cursorY = PAGE_H - MARGIN_TOP

  // ── Header ─────────────────────────────────────────────────────────────────

  // Wordmark
  const iconSize = 28
  if (brandIcon) {
    page.drawImage(brandIcon, {
      x: MARGIN_X,
      y: cursorY - iconSize + 4,
      width: iconSize,
      height: iconSize,
    })
  }

  const textX = MARGIN_X + (brandIcon ? iconSize + 8 : 0)

  page.drawText("Con", {
    x: textX,
    y: cursorY,
    font: fontBold,
    size: 20,
    color: PDF_COLORS.navy,
  })
  const conW = fontBold.widthOfTextAtSize("Con", 20)
  page.drawText("trazy", {
    x: textX + conW,
    y: cursorY,
    font: fontBold,
    size: 20,
    color: PDF_COLORS.teal,
  })

  // Invoice title (right aligned)
  const titleW = fontBold.widthOfTextAtSize(labels.title, 16)
  page.drawText(labels.title, {
    x: PAGE_W - MARGIN_X - titleW,
    y: cursorY,
    font: fontBold,
    size: 16,
    color: PDF_COLORS.textSoft,
  })

  cursorY -= 36
  drawDivider(page, cursorY, true)
  cursorY -= 20

  // ── Meta block ─────────────────────────────────────────────────────────────

  // Left column: invoice number + issue date
  page.drawText(labels.invoiceNumber, {
    x: MARGIN_X,
    y: cursorY,
    font: fontRegular,
    size: 8,
    color: PDF_COLORS.textMuted,
  })
  page.drawText(invoiceNumber, {
    x: MARGIN_X,
    y: cursorY - 14,
    font: fontBold,
    size: 11,
    color: PDF_COLORS.text,
  })

  page.drawText(labels.issueDate, {
    x: MARGIN_X + 200,
    y: cursorY,
    font: fontRegular,
    size: 8,
    color: PDF_COLORS.textMuted,
  })
  page.drawText(formatDate(new Date(), locale), {
    x: MARGIN_X + 200,
    y: cursorY - 14,
    font: fontRegular,
    size: 11,
    color: PDF_COLORS.text,
  })

  cursorY -= 36

  // Vendor details
  page.drawText(labels.vendor, {
    x: MARGIN_X,
    y: cursorY,
    font: fontRegular,
    size: 8,
    color: PDF_COLORS.textMuted,
  })
  cursorY -= 14

  page.drawText(vendorProfile.businessName ?? "—", {
    x: MARGIN_X,
    y: cursorY,
    font: fontBold,
    size: 11,
    color: PDF_COLORS.text,
  })
  cursorY -= 14

  if (vendorProfile.vatNumber) {
    page.drawText(`${labels.vatNumber}: ${vendorProfile.vatNumber}`, {
      x: MARGIN_X,
      y: cursorY,
      font: fontRegular,
      size: 9.5,
      color: PDF_COLORS.textSoft,
    })
    cursorY -= 14
  }

  if (vendorProfile.businessAddress) {
    page.drawText(vendorProfile.businessAddress, {
      x: MARGIN_X,
      y: cursorY,
      font: fontRegular,
      size: 9.5,
      color: PDF_COLORS.textSoft,
      maxWidth: CONTENT_W / 2,
    })
    cursorY -= 14
  }

  cursorY -= 16
  drawDivider(page, cursorY, true)
  cursorY -= 18

  // ── Transaction section ────────────────────────────────────────────────────

  cursorY = drawSectionHeader(page, labels.transactionSection, cursorY, fontBold)
  cursorY -= 4

  cursorY = drawLabelValue(page, labels.reference, payment.transaction.reference, cursorY, fonts)
  cursorY = drawLabelValue(page, labels.transactionTitle, payment.transaction.title, cursorY, fonts)

  if (payment.transaction.clientProfile?.fullName) {
    cursorY = drawLabelValue(page, labels.client, payment.transaction.clientProfile.fullName, cursorY, fonts)
  }

  cursorY = drawLabelValue(page, labels.operation, kindLabel, cursorY, fonts)
  cursorY = drawLabelValue(page, labels.operationDate, formatDate(processedAt, locale), cursorY, fonts)

  cursorY -= 18
  drawDivider(page, cursorY)
  cursorY -= 18

  // ── Fee breakdown section ──────────────────────────────────────────────────

  cursorY = drawSectionHeader(page, labels.feeSection, cursorY, fontBold)
  cursorY -= 4

  cursorY = drawFeeRow(page, labels.grossAmount, formatMoney(payment.amount, currency), cursorY, fonts)
  cursorY = drawFeeRow(page, labels.stripeFee, formatMoney(stripeFee, currency), cursorY, fonts)
  cursorY = drawFeeRow(page, labels.contrazyFee, formatMoney(contrazyFee, currency), cursorY, fonts)

  // Divider before totals
  cursorY -= 2
  page.drawLine({
    start: { x: MARGIN_X + 8, y: cursorY },
    end: { x: PAGE_W - MARGIN_X - 8, y: cursorY },
    thickness: 0.8,
    color: PDF_COLORS.border,
  })
  cursorY -= 2

  cursorY = drawFeeRow(page, labels.totalFees, formatMoney(totalFees, currency), cursorY, fonts, true)
  cursorY = drawFeeRow(page, labels.vendorNet, formatMoney(vendorNet, currency), cursorY, fonts, true)

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footerY = MARGIN_TOP + 40
  drawDivider(page, footerY + 16)

  const footerLines = wrapText(labels.footer, fontRegular, 8.5, CONTENT_W)
  footerLines.forEach((line, i) => {
    page.drawText(line, {
      x: MARGIN_X,
      y: footerY - i * 12,
      font: fontRegular,
      size: 8.5,
      color: PDF_COLORS.textMuted,
    })
  })

  const pdfBytes = await pdf.save()
  return Buffer.from(pdfBytes)
}
