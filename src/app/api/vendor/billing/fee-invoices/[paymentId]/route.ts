import { NextResponse } from "next/server"

import sparticuzChromium from "@sparticuz/chromium"
import { chromium as playwrightCoreChromium } from "playwright-core"

import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getSiteUrl } from "@/lib/site-url"
import { createFeeInvoiceRenderToken } from "@/features/subscriptions/server/fee-invoice-render-auth"

export const runtime = "nodejs"
export const maxDuration = 60

const PDF_RENDER_TIMEOUT_MS = Number(process.env.CONTRAZY_PDF_TIMEOUT_MS ?? 45_000)

function buildInvoiceNumber(paymentId: string, processedAt: Date): string {
  const dateStr = processedAt.toISOString().slice(0, 10).replace(/-/g, "")
  return `CZ-FEE-${dateStr}-${paymentId.slice(-6).toUpperCase()}`
}

function getPdfRenderBaseUrl() {
  const explicit =
    process.env.CONTRAZY_PDF_RENDER_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL

  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`
  }

  return getSiteUrl()
}

function isProductionPdfRuntime() {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    process.env.CONTRAZY_PDF_RUNTIME === "serverless"
  )
}

async function importRuntimeModule<T = unknown>(specifier: string): Promise<T> {
  return (0, eval)(`import(${JSON.stringify(specifier)})`) as Promise<T>
}

async function launchPdfBrowser() {
  if (isProductionPdfRuntime()) {
    const executablePath = await sparticuzChromium.executablePath()

    if (!executablePath) {
      throw new Error("Unable to resolve serverless Chromium executable path.")
    }

    return playwrightCoreChromium.launch({
      args: sparticuzChromium.args ?? [],
      executablePath,
      headless: true,
    })
  }

  const { chromium } = await importRuntimeModule<typeof import("playwright")>("playwright")
  return chromium.launch({ headless: true })
}

async function buildFeeInvoicePdf(
  paymentId: string,
  locale: string
): Promise<Buffer> {
  const browser = await launchPdfBrowser()

  try {
    // 794 × 1123 px = A4 at 96 DPI — matches the PDF format below
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
    })

    const baseUrl = getPdfRenderBaseUrl().replace(/\/$/, "")
    const renderToken = createFeeInvoiceRenderToken(paymentId)
    const renderUrl = `${baseUrl}/${locale}/print/fee-invoice/${paymentId}?sig=${renderToken}`

    page.setDefaultTimeout(PDF_RENDER_TIMEOUT_MS)
    const response = await page.goto(renderUrl, {
      waitUntil: "networkidle",
      timeout: PDF_RENDER_TIMEOUT_MS,
    })

    if (!response?.ok()) {
      throw new Error(
        `Fee invoice render failed with HTTP ${response?.status() ?? "unknown"}.`
      )
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      pageRanges: "1",
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        processedAt: true,
        createdAt: true,
        transaction: { select: { vendorId: true } },
      },
    })

    if (!payment) {
      return NextResponse.json({ success: false, message: "Payment not found." }, { status: 404 })
    }

    if (payment.transaction.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 })
    }

    const url = new URL(request.url)
    const localeParam = url.searchParams.get("locale")
    const localeHeader = request.headers.get("accept-language") ?? ""
    const locale: "en" | "fr" =
      localeParam === "fr" || (!localeParam && localeHeader.toLowerCase().startsWith("fr"))
        ? "fr"
        : "en"

    const processedAt = payment.processedAt ?? payment.createdAt
    const invoiceNumber = buildInvoiceNumber(payment.id, processedAt)

    const pdfBuffer = await buildFeeInvoicePdf(payment.id, locale)

    const safeFileName = `contrazy-invoice-${invoiceNumber}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Fee invoice generation error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to generate invoice." },
      { status: 500 }
    )
  }
}
