import { createHash } from "crypto"
import { readFile } from "fs/promises"
import { join } from "path"

import type { Prisma, PrismaClient } from "@prisma/client"
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib"

import { renderContractContent } from "@/features/contracts/server/contract-rendering"
import { htmlToDocumentBlocks } from "@/features/contracts/contract-document-model"
import { createSignedDocumentRenderToken } from "@/features/contracts/server/signed-document-render-auth"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { cloudinary } from "@/lib/integrations/cloudinary"
import { getSiteUrl } from "@/lib/site-url"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

type ContractTemplateSnapshot = {
  id: string
  name: string
  description: string | null
  content: string
}

const contractArtifactInclude = {
  vendor: true,
  clientProfile: true,
  contractTemplate: true,
  contractArtifact: true,
  signatureRecord: true,
} satisfies Prisma.TransactionInclude

const PDF_RENDER_TIMEOUT_MS = Number(process.env.CONTRAZY_PDF_TIMEOUT_MS ?? 45_000)

type TransactionWithContractContext = Prisma.TransactionGetPayload<{
  include: typeof contractArtifactInclude
}>

type PreparedSignedArtifactRender = {
  transaction: TransactionWithContractContext
  renderedContentBeforeSignature: string
  renderedContentAfterSignature: string
  signedAt: Date
  signedTimezone: string
  signerName: string
  signerEmail: string
  signatureMethod: string
  ipAddress: string | null
  signatureBytes: Uint8Array
}

function isProductionPdfRuntime() {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    process.env.CONTRAZY_PDF_RUNTIME === "serverless"
  )
}

async function importRuntimeModule<T = any>(specifier: string): Promise<T> {
  return (0, eval)(`import(${JSON.stringify(specifier)})`) as Promise<T>
}

async function launchPdfBrowser() {
  if (isProductionPdfRuntime()) {
    const [{ chromium: playwrightChromium }, chromiumModule] = await Promise.all([
      importRuntimeModule<any>("playwright-core"),
      importRuntimeModule<any>("@sparticuz/chromium"),
    ])

    const chromium = chromiumModule.default ?? chromiumModule
    const executablePath = await chromium.executablePath()

    if (!executablePath) {
      throw new Error("Unable to resolve serverless Chromium executable path.")
    }

    return playwrightChromium.launch({
      args: chromium.args ?? [],
      executablePath,
      headless: typeof chromium.headless === "boolean" ? chromium.headless : true,
    })
  }

  const { chromium } = await importRuntimeModule<any>("playwright")

  return chromium.launch({
    headless: true,
  })
}

function getPdfRenderBaseUrl() {
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`
  }

  return getSiteUrl()
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

// ─── PDF layout helpers ───────────────────────────────────────────────────────

const PAGE_W = 760
const PAGE_MARGIN_X = 52
const PAGE_TOP_MARGIN = 44
const PAGE_BOTTOM_MARGIN = 44
const CONTENT_W = PAGE_W - PAGE_MARGIN_X * 2
const BRAND_ICON_PATH = join(process.cwd(), "public", "logo", "favicon-contrazy-64.png")

const PDF_COLORS = {
  text: rgb(0.09, 0.12, 0.16),
  textSoft: rgb(0.35, 0.4, 0.46),
  textMuted: rgb(0.58, 0.62, 0.68),
  border: rgb(0.88, 0.9, 0.93),
  borderStrong: rgb(0.82, 0.85, 0.89),
  panel: rgb(0.973, 0.979, 0.987),
  paper: rgb(1, 1, 1),
  teal: rgb(0.067, 0.788, 0.69),
  navy: rgb(0.047, 0.118, 0.184),
} as const

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
        // If single word is too long, force-split it
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

function formatDatetime(d: Date, timezone: string) {
  try {
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d)
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d)
    return `${date} at ${time} (${timezone})`
  } catch {
    return d.toISOString()
  }
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) {
    return null
  }

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "EUR",
    }).format(amount / 100)
  } catch {
    return `${currency ?? "EUR"} ${(amount / 100).toFixed(2)}`
  }
}

function measureTextHeight(text: string, font: PDFFont, size: number, width: number, lineHeight = size * 1.35) {
  return wrapText(text, font, size, width).length * lineHeight
}

function drawFixedText(
  page: PDFPage,
  text: string,
  options: {
    x: number
    y: number
    width: number
    font: PDFFont
    size: number
    color: ReturnType<typeof rgb>
    lineHeight?: number
  }
) {
  const lines = wrapText(text, options.font, options.size, options.width)
  const lineHeight = options.lineHeight ?? options.size * 1.35

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      font: options.font,
      size: options.size,
      color: options.color,
    })
  })

  return lines.length * lineHeight
}

async function embedBrandIcon(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(BRAND_ICON_PATH)
    return await pdf.embedPng(bytes)
  } catch {
    return null
  }
}

function drawWordmark(
  page: PDFPage,
  options: {
    icon: PDFImage | null
    font: PDFFont
    x: number
    y: number
    size: number
    muted?: boolean
  }
) {
  const iconSize = options.size + 8
  const textX = options.x + iconSize + 10

  if (options.icon) {
    page.drawImage(options.icon, {
      x: options.x,
      y: options.y - iconSize + 4,
      width: iconSize,
      height: iconSize,
      opacity: options.muted ? 0.82 : 1,
    })
  }

  const conText = "Con"
  const conColor = options.muted ? PDF_COLORS.textMuted : PDF_COLORS.navy
  const trazyColor = options.muted ? PDF_COLORS.textSoft : PDF_COLORS.teal

  page.drawText(conText, {
    x: textX,
    y: options.y,
    font: options.font,
    size: options.size,
    color: conColor,
  })

  const conWidth = options.font.widthOfTextAtSize(conText, options.size)

  page.drawText("trazy", {
    x: textX + conWidth,
    y: options.y,
    font: options.font,
    size: options.size,
    color: trazyColor,
  })
}

type SummaryRow = {
  label: string
  value: string
  mono?: boolean
}

function measureSummaryRowsHeight(
  rows: SummaryRow[],
  fonts: { label: PDFFont; value: PDFFont },
  width: number
) {
  let total = 0
  const labelWidth = 130
  const valueWidth = width - labelWidth - 18

  for (const row of rows) {
    const valueHeight = measureTextHeight(row.value, fonts.value, 11.5, valueWidth, 16)
    total += Math.max(22, valueHeight + 8)
  }

  return total
}

function drawSummaryRows(
  page: PDFPage,
  rows: SummaryRow[],
  options: {
    x: number
    y: number
    width: number
    labelFont: PDFFont
    valueFont: PDFFont
  }
) {
  const labelWidth = 130
  const valueX = options.x + labelWidth + 18
  const valueWidth = options.width - labelWidth - 18
  let cursorY = options.y

  rows.forEach((row, index) => {
    const valueFont = row.mono ? options.labelFont : options.valueFont
    const valueHeight = measureTextHeight(row.value, valueFont, 11.5, valueWidth, 16)
    const rowHeight = Math.max(22, valueHeight + 8)

    page.drawText(row.label, {
      x: options.x,
      y: cursorY - 14,
      font: options.labelFont,
      size: 8.2,
      color: PDF_COLORS.textMuted,
    })

    drawFixedText(page, row.value, {
      x: valueX,
      y: cursorY - 14,
      width: valueWidth,
      font: valueFont,
      size: 11.5,
      color: PDF_COLORS.text,
      lineHeight: 16,
    })

    page.drawLine({
      start: { x: options.x, y: cursorY - rowHeight },
      end: { x: options.x + options.width, y: cursorY - rowHeight },
      thickness: index === rows.length - 1 ? 0.7 : 0.55,
      color: PDF_COLORS.border,
    })

    cursorY -= rowHeight
  })

  return cursorY
}

type PdfBlockStyle = {
  font: "ui" | "uiBold"
  size: number
  lineHeight: number
  marginTop: number
  marginBottom: number
  indent?: number
}

function getPdfBlockStyle(block: ReturnType<typeof htmlToDocumentBlocks>[number]): PdfBlockStyle | null {
  switch (block.type) {
    case "h1":
      return { font: "uiBold", size: 22, lineHeight: 28, marginTop: 0, marginBottom: 10 }
    case "h2":
      return { font: "uiBold", size: 16, lineHeight: 22, marginTop: 16, marginBottom: 6 }
    case "h3":
      return { font: "uiBold", size: 13.5, lineHeight: 19, marginTop: 12, marginBottom: 4 }
    case "li":
      return { font: "ui", size: 11.25, lineHeight: 18, marginTop: 0, marginBottom: 4, indent: 12 }
    case "para":
      return { font: "ui", size: 11.25, lineHeight: 18, marginTop: 0, marginBottom: 10 }
    case "blank":
      return null
  }
}

function measureDocumentBlocksHeight(
  blocks: ReturnType<typeof htmlToDocumentBlocks>,
  fonts: { ui: PDFFont; uiBold: PDFFont },
  width: number
) {
  let total = 0

  for (const block of blocks) {
    if (block.type === "blank") {
      total += 8
      continue
    }

    const style = getPdfBlockStyle(block)

    if (!style) {
      continue
    }

    const font = style.font === "uiBold" ? fonts.uiBold : fonts.ui
    const textWidth = width - (style.indent ?? 0)
    total += style.marginTop
    total += measureTextHeight(block.text, font, style.size, textWidth, style.lineHeight)
    total += style.marginBottom
  }

  return total
}

function drawDocumentBlocks(
  page: PDFPage,
  blocks: ReturnType<typeof htmlToDocumentBlocks>,
  options: {
    x: number
    y: number
    width: number
    ui: PDFFont
    uiBold: PDFFont
  }
) {
  let cursorY = options.y

  for (const block of blocks) {
    if (block.type === "blank") {
      cursorY -= 8
      continue
    }

    const style = getPdfBlockStyle(block)
    if (!style) {
      continue
    }

    const font = style.font === "uiBold" ? options.uiBold : options.ui
    const textX = options.x + (style.indent ?? 0)
    const textWidth = options.width - (style.indent ?? 0)

    cursorY -= style.marginTop
    const textHeight = drawFixedText(page, block.text, {
      x: textX,
      y: cursorY,
      width: textWidth,
      font,
      size: style.size,
      color: PDF_COLORS.text,
      lineHeight: style.lineHeight,
    })
    cursorY -= textHeight + style.marginBottom
  }

  return cursorY
}

function measureSignatureSectionHeight(
  auditRows: Array<[string, string]>,
  fonts: { label: PDFFont; value: PDFFont },
  width: number
) {
  const signatureColWidth = 192
  const auditWidth = width - signatureColWidth - 28
  const auditValueWidth = auditWidth - 94
  let auditHeight = 0

  for (const [label, value] of auditRows) {
    const rowHeight = Math.max(
      18,
      measureTextHeight(value, fonts.value, 11, auditValueWidth, 15) + 2
    )
    auditHeight += rowHeight
  }

  const auditPanelHeight = Math.max(92, auditHeight + 24)
  const signaturePanelHeight = Math.max(124, auditPanelHeight)

  return 16 + 18 + 16 + signaturePanelHeight + 28 + 34
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

async function buildSignedContractPdf({
  transactionId,
  transactionReference,
}: {
  transactionId: string
  transactionReference: string
}) {
  const browser = await launchPdfBrowser()

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    })

    const baseUrl = getPdfRenderBaseUrl().replace(/\/$/, "")
    const renderToken = createSignedDocumentRenderToken(transactionId)
    const renderUrl = `${baseUrl}/print/signed-agreement/${transactionId}?sig=${renderToken}`

    page.setDefaultTimeout(PDF_RENDER_TIMEOUT_MS)
    await page.goto(renderUrl, { waitUntil: "networkidle", timeout: PDF_RENDER_TIMEOUT_MS })

    const contentHeight = await page.evaluate(() =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
      )
    )

    const pdfBuffer = await page.pdf({
      width: "1280px",
      height: `${Math.ceil(contentHeight + 24)}px`,
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      pageRanges: "1",
    })

    return pdfBuffer
  } finally {
    await browser.close()
  }
}

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

async function uploadRawPdf(buffer: Buffer, transactionReference: string) {
  const publicId = `contracts/${slugifySegment(transactionReference)}-signed`

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "conntrazy",
        public_id: publicId,
        resource_type: "raw",
        format: "pdf",
        overwrite: true,
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error("Cloudinary PDF upload failed"))
          return
        }
        resolve({ secure_url: uploadResult.secure_url, public_id: uploadResult.public_id })
      }
    )
    stream.end(buffer)
  })

  return result
}

async function uploadSignatureImage(signatureDataUrl: string, transactionReference: string) {
  const publicId = `contracts/${slugifySegment(transactionReference)}-signature`

  const result = await cloudinary.uploader.upload(signatureDataUrl, {
    folder: "conntrazy",
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
  })

  return { secureUrl: result.secure_url, publicId: result.public_id }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function getTemplateContentSnapshot(transaction: TransactionWithContractContext) {
  return (
    transaction.contractArtifact?.templateContentSnapshot ??
    transaction.contractTemplate?.content ??
    ""
  )
}

async function prepareSignedArtifactRender(
  db: DatabaseClient,
  input: {
    transactionId: string
    signatureDataUrl: string
    signedTimezone?: string | null
  }
): Promise<PreparedSignedArtifactRender | null> {
  const transaction = await db.transaction.findUnique({
    where: { id: input.transactionId },
    include: contractArtifactInclude,
  })

  if (!transaction?.clientProfile) {
    return null
  }

  const templateContentSnapshot = getTemplateContentSnapshot(transaction)

  if (!templateContentSnapshot) {
    return null
  }

  await ensureTransactionContractArtifact(db, input.transactionId)

  const signedAt = transaction.signatureRecord?.signedAt ?? new Date()
  const signedTimezone = input.signedTimezone?.trim() || "UTC"
  const signerName =
    transaction.signatureRecord?.signerName ||
    transaction.clientProfile.fullName ||
    "Client"
  const signerEmail = transaction.signatureRecord?.signerEmail || transaction.clientProfile.email || ""
  const signatureMethod = transaction.signatureRecord?.method || "Electronic Signature"
  const ipAddress = transaction.signatureRecord?.ipAddress ?? null

  const renderedContentBeforeSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
  })

  const renderedContentAfterSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
    signerName,
    signedAt,
    signedTimezone,
  })

  const base64Payload = input.signatureDataUrl.split(",")[1] ?? ""
  const signatureBytes = Buffer.from(base64Payload, "base64")

  return {
    transaction,
    renderedContentBeforeSignature,
    renderedContentAfterSignature,
    signedAt,
    signedTimezone,
    signerName,
    signerEmail,
    signatureMethod,
    ipAddress,
    signatureBytes,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createTransactionContractArtifact(
  db: DatabaseClient,
  input: {
    transactionId: string
    contractTemplate: ContractTemplateSnapshot | null
  }
) {
  if (!input.contractTemplate) {
    return null
  }

  const artifact = await db.transactionContractArtifact.upsert({
    where: { transactionId: input.transactionId },
    update: {
      sourceTemplateId: input.contractTemplate.id,
      sourceTemplateName: input.contractTemplate.name,
      sourceTemplateDescription: input.contractTemplate.description,
      templateContentSnapshot: input.contractTemplate.content,
    },
    create: {
      transactionId: input.transactionId,
      sourceTemplateId: input.contractTemplate.id,
      sourceTemplateName: input.contractTemplate.name,
      sourceTemplateDescription: input.contractTemplate.description,
      templateContentSnapshot: input.contractTemplate.content,
    },
  })

  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "CONTRACT_SNAPSHOT_CREATED",
    title: "Contract snapshot created",
    detail: `A transaction-level contract snapshot was created from "${input.contractTemplate.name}".`,
    dedupeKey: `event:contract-snapshot:${input.transactionId}`,
  })

  return artifact
}

export async function ensureTransactionContractArtifact(
  db: DatabaseClient,
  transactionId: string
) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      contractTemplate: true,
      contractArtifact: true,
    },
  })

  if (!transaction?.contractTemplate) {
    return null
  }

  if (transaction.contractArtifact) {
    return transaction.contractArtifact
  }

  return createTransactionContractArtifact(db, {
    transactionId,
    contractTemplate: {
      id: transaction.contractTemplate.id,
      name: transaction.contractTemplate.name,
      description: transaction.contractTemplate.description,
      content: transaction.contractTemplate.content,
    },
  })
}

export async function persistReviewedContractSnapshot(
  db: DatabaseClient,
  transactionId: string
) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: contractArtifactInclude,
  })

  if (!transaction) {
    return null
  }

  const templateContentSnapshot = getTemplateContentSnapshot(transaction)

  if (!templateContentSnapshot) {
    return null
  }

  await ensureTransactionContractArtifact(db, transactionId)

  const renderedContentBeforeSignature = renderContractContent({
    templateContent: templateContentSnapshot,
    clientProfile: transaction.clientProfile,
    vendorName: transaction.vendor?.businessName,
    transactionReference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
  })

  return db.transactionContractArtifact.update({
    where: { transactionId },
    data: {
      renderedContentBeforeSignature,
      reviewCompletedAt: new Date(),
    },
  })
}

export async function generateSignedContractArtifact(
  db: DatabaseClient,
  input: {
    transactionId: string
    signatureDataUrl: string
    signedTimezone?: string | null
  }
) {
  const prepared = await prepareSignedArtifactRender(db, input)

  if (!prepared) {
    return null
  }

  const {
    transaction,
    renderedContentBeforeSignature,
    renderedContentAfterSignature,
    signedAt,
    signedTimezone,
  } = prepared

  const signatureUpload = await uploadSignatureImage(input.signatureDataUrl, transaction.reference)

  const pdfBytes = await buildSignedContractPdf({
    transactionId: input.transactionId,
    transactionReference: transaction.reference,
  })

  const pdfBuffer = Buffer.from(pdfBytes)
  const signedPdfHash = createHash("sha256").update(pdfBuffer).digest("hex")
  const pdfUpload = await uploadRawPdf(pdfBuffer, transaction.reference)

  const artifact = await db.transactionContractArtifact.update({
    where: { transactionId: input.transactionId },
    data: {
      renderedContentBeforeSignature,
      renderedContentAfterSignature,
      signatureImageUrl: signatureUpload.secureUrl,
      signatureImagePublicId: signatureUpload.publicId,
      signedPdfUrl: pdfUpload.secure_url,
      signedPdfPublicId: pdfUpload.public_id,
      signedPdfHash,
      signedAt,
      signedTimezone,
    },
  })

  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "SIGNED_PDF_GENERATED",
    title: "Signed agreement generated",
    detail: "The final signed PDF artifact was generated and stored.",
    metadata: {
      signedPdfUrl: artifact.signedPdfUrl,
      signedPdfHash: artifact.signedPdfHash,
    },
    dedupeKey: `event:signed-pdf:${input.transactionId}`,
  })

  return artifact
}

export async function generateSignedContractPdfPreview(
  db: DatabaseClient,
  input: {
    transactionId: string
  }
) {
  const transaction = await db.transaction.findUnique({
    where: { id: input.transactionId },
    include: contractArtifactInclude,
  })

  const signatureDataUrl = transaction?.signatureRecord?.signatureDataUrl

  if (!transaction || !signatureDataUrl) {
    return null
  }

  const prepared = await prepareSignedArtifactRender(db, {
    transactionId: input.transactionId,
    signatureDataUrl,
    signedTimezone: transaction.contractArtifact?.signedTimezone ?? "UTC",
  })

  if (!prepared) {
    return null
  }

  const pdfBytes = await buildSignedContractPdf({
    transactionId: input.transactionId,
    transactionReference: prepared.transaction.reference,
  })

  return {
    fileName: `${prepared.transaction.reference}-signed-preview.pdf`,
    pdfBuffer: Buffer.from(pdfBytes),
  }
}
