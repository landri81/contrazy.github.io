import { NextResponse } from "next/server"
import * as mammoth from "mammoth"

import { sanitizeContractTemplateContent } from "@/features/contracts/server/contract-rendering"
import { stripContractMarkup } from "@/features/contracts/contract-content"
import { MAX_VENDOR_CONTRACT_IMPORT_BYTES } from "@/features/contracts/contract-template-inline-assets"
import {
  ensureVendorPreparationAllowed,
  ensureVendorSubscriptionEligible,
  requireVendorProfileAccess,
} from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 60

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function stripImportedImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, "")
}

function looksLikeHeading(line: string) {
  return (
    line.length <= 90 &&
    !/[.!?]$/.test(line) &&
    (line === line.toUpperCase() || /^[A-Z][A-Za-z0-9 ,:/()'-]+$/.test(line))
  )
}

function convertPlainTextImportToHtml(text: string) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())

  const html: string[] = []
  let paragraphLines: string[] = []
  let unorderedItems: string[] = []
  let orderedItems: string[] = []

  function flushParagraph() {
    if (paragraphLines.length === 0) return
    html.push(`<p>${paragraphLines.map((line) => escapeHtml(line.trim())).join("<br>")}</p>`)
    paragraphLines = []
  }

  function flushUnordered() {
    if (unorderedItems.length === 0) return
    html.push(`<ul>${unorderedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`)
    unorderedItems = []
  }

  function flushOrdered() {
    if (orderedItems.length === 0) return
    html.push(`<ol>${orderedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`)
    orderedItems = []
  }

  function flushAll() {
    flushParagraph()
    flushUnordered()
    flushOrdered()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushAll()
      continue
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      flushUnordered()
      orderedItems.push(orderedMatch[1].trim())
      continue
    }

    const unorderedMatch = line.match(/^[-*•]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()
      flushOrdered()
      unorderedItems.push(unorderedMatch[1].trim())
      continue
    }

    if (looksLikeHeading(line)) {
      flushAll()
      html.push(`<h2>${escapeHtml(line)}</h2>`)
      continue
    }

    flushOrdered()
    flushUnordered()
    paragraphLines.push(line)
  }

  flushAll()

  return html.join("") || "<p><br></p>"
}

async function importDocx(buffer: Buffer) {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      includeDefaultStyleMap: true,
      ignoreEmptyParagraphs: false,
    }
  )

  return stripImportedImages(result.value)
}

async function importPdf(buffer: Buffer): Promise<string> {
  // Dynamic import keeps any load-time failures inside the async call stack,
  // where the route's try/catch can handle them instead of crashing the module.
  // GlobalWorkerOptions.workerSrc = "" forces pdfjs to run on the main thread
  // (fake worker) — web workers are not available in Vercel serverless functions.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,   // no internal fetch in serverless
    isEvalSupported: false,  // eval() may be blocked in hardened Lambda envs
    useSystemFonts: true,    // avoid loading external font files
    disableFontFace: true,   // text extraction only — no rendering, no canvas
  })

  const pdfDoc = await loadingTask.promise
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const { items } = await page.getTextContent()

    let prevY: number | null = null
    const lineBuffer: string[] = []
    const pageLines: string[] = []

    for (const item of items) {
      if (!("str" in item)) continue
      const { str, transform, hasEOL } = item as {
        str: string
        transform: number[]
        hasEOL: boolean
      }
      const y = transform[5]

      // New line when Y coordinate changes meaningfully
      if (prevY !== null && Math.abs(y - prevY) > 3) {
        if (lineBuffer.length) {
          pageLines.push(lineBuffer.join(""))
          lineBuffer.length = 0
        }
      }

      lineBuffer.push(str)

      if (hasEOL) {
        pageLines.push(lineBuffer.join(""))
        lineBuffer.length = 0
      }

      prevY = y
    }

    if (lineBuffer.length) pageLines.push(lineBuffer.join(""))

    pageTexts.push(pageLines.filter((l) => l.trim()).join("\n"))
    page.cleanup()
  }

  await pdfDoc.cleanup()

  return convertPlainTextImportToHtml(pageTexts.filter(Boolean).join("\n\n"))
}

function getFileKind(file: File) {
  const lowerName = file.name.toLowerCase()

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx"
  }

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf"
  }

  return null
}

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "No import file was provided." }, { status: 400 })
    }

    const kind = getFileKind(file)

    if (!kind) {
      return NextResponse.json(
        { ok: false, message: "Only DOCX and PDF files can be imported." },
        { status: 400 }
      )
    }

    if (file.size > MAX_VENDOR_CONTRACT_IMPORT_BYTES) {
      return NextResponse.json(
        { ok: false, message: "The import file is too large." },
        { status: 422 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawHtml = kind === "docx" ? await importDocx(buffer) : await importPdf(buffer)
    const html = sanitizeContractTemplateContent(rawHtml)

    if (!stripContractMarkup(html).trim()) {
      return NextResponse.json(
        { ok: false, message: "The imported file did not contain usable contract content." },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true, html })
  } catch (error) {
    console.error("Contract import failed", error)
    return NextResponse.json(
      { ok: false, message: "Unable to import this document right now." },
      { status: 500 }
    )
  }
}
