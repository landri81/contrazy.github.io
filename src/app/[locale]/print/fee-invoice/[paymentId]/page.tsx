import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import {
  FeeInvoicePrint,
  type FeeInvoicePrintData,
  type FeeInvoicePrintLabels,
} from "@/features/subscriptions/components/fee-invoice-print"
import { verifyFeeInvoiceRenderToken } from "@/features/subscriptions/server/fee-invoice-render-auth"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function buildInvoiceNumber(paymentId: string, processedAt: Date): string {
  const dateStr = processedAt.toISOString().slice(0, 10).replace(/-/g, "")
  return `CZ-FEE-${dateStr}-${paymentId.slice(-6).toUpperCase()}`
}

function formatDate(date: Date, locale: string): string {
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB"
  return date.toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * VAT calculation — all amounts in integer cents.
 * The stored platformFeeAmount is already VAT-inclusive (TTC).
 * Formula: HT = round(TTC / 1.20), TVA = TTC - HT
 */
function calcVat(feeInclVatCents: number): { exclVat: number; vatAmount: number } {
  const exclVat = Math.round(feeInclVatCents / 1.2)
  const vatAmount = feeInclVatCents - exclVat
  return { exclVat, vatAmount }
}

export default async function FeeInvoicePrintPage(props: {
  params: Promise<{ locale: string; paymentId: string }>
  searchParams: Promise<{ sig?: string }>
}) {
  const { locale, paymentId } = await props.params
  const { sig } = await props.searchParams

  if (!verifyFeeInvoiceRenderToken(paymentId, sig)) {
    notFound()
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      transaction: {
        include: {
          clientProfile: { select: { fullName: true } },
          vendor: {
            select: {
              businessName: true,
              businessEmail: true,
              businessAddress: true,
              vatNumber: true,
            },
          },
        },
      },
    },
  })

  if (!payment) {
    notFound()
  }

  const t = await getTranslations("subscriptions.billing.feeOperations.invoice")
  const tOps = await getTranslations("subscriptions.billing.feeOperations")

  const processedAt = payment.processedAt ?? payment.createdAt
  const invoiceNumber = buildInvoiceNumber(payment.id, processedAt)

  const kindKey = `kinds.${payment.kind}` as Parameters<typeof tOps>[0]
  const kindLabel = payment.kind
    ? tOps.has(kindKey)
      ? tOps(kindKey)
      : payment.kind
    : "—"

  // VAT-inclusive amount = what Contrazy charges (platformFeeAmount is stored TTC)
  const feeInclVat = payment.platformFeeAmount ?? 0
  const { exclVat: feeExclVat, vatAmount } = calcVat(feeInclVat)

  const data: FeeInvoicePrintData = {
    invoiceNumber,
    issueDateFormatted: formatDate(processedAt, locale),
    vendorName: payment.transaction.vendor?.businessName ?? "—",
    vendorEmail: payment.transaction.vendor?.businessEmail ?? null,
    vendorAddress: payment.transaction.vendor?.businessAddress ?? null,
    vendorVatNumber: payment.transaction.vendor?.vatNumber ?? null,
    clientName: payment.transaction.clientProfile?.fullName ?? null,
    transactionReference: payment.transaction.reference,
    transactionTitle: payment.transaction.title,
    kindLabel: kindLabel ?? payment.kind,
    processedAtFormatted: formatDate(processedAt, locale),
    contrazyFeeInclVat: feeInclVat,
    contrazyFeeExclVat: feeExclVat,
    vatAmount,
    currency: payment.currency,
    locale,
  }

  const labels: FeeInvoicePrintLabels = {
    title: t("title"),
    invoiceNumber: t("invoiceNumber"),
    issueDate: t("issueDate"),
    issuedBy: t("issuedBy"),
    billedTo: t("billedTo"),
    vatNumber: t("vatNumber"),
    registrationNumber: t("registrationNumber"),
    transaction: t("transaction"),
    reference: t("reference"),
    transactionTitle: t("transactionTitle"),
    client: t("client"),
    operation: t("operation"),
    operationDate: t("operationDate"),
    chargesSection: t("chargesSection"),
    contrazyFeeInclVat: t("contrazyFeeInclVat"),
    contrazyFeeExclVat: t("contrazyFeeExclVat"),
    vatLine: t("vatLine"),
    totalDue: t("totalDue"),
    stripeSeparateNote: t("stripeSeparateNote"),
    footerNote: t("footerNote"),
  }

  return <FeeInvoicePrint data={data} labels={labels} />
}
