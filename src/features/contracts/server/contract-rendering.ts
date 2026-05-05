import sanitizeHtml from "sanitize-html"
import { convert } from "html-to-text"

import {
  escapeContractHtml,
  normalizeContractTemplateMarkup,
} from "@/features/contracts/contract-content"

type ContractClientSnapshot = {
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  companyName?: string | null
  address?: string | null
  country?: string | null
}

type RenderContractContentInput = {
  templateContent: string
  clientProfile?: ContractClientSnapshot | null
  vendorName?: string | null
  transactionReference: string
  amount?: number | null
  depositAmount?: number | null
  signerName?: string | null
  signedAt?: Date | null
  signedTimezone?: string | null
}

const allowedClasses = ["ql-align-center", "ql-align-right", "ql-align-justify"]

const contractSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "blockquote",
    "ol",
    "ul",
    "li",
    "h1",
    "h2",
    "h3",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    p: ["class"],
    h1: ["class"],
    h2: ["class"],
    h3: ["class"],
    li: ["class"],
    blockquote: ["class"],
  },
  allowedClasses: {
    p: allowedClasses,
    h1: allowedClasses,
    h2: allowedClasses,
    h3: allowedClasses,
    li: allowedClasses,
    blockquote: allowedClasses,
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noreferrer noopener",
    }),
  },
}

function formatMoney(amount: number | null | undefined) {
  if (!amount) {
    return "0.00"
  }

  return (amount / 100).toFixed(2)
}

export function buildClientDisplayName(clientProfile?: ContractClientSnapshot | null) {
  if (!clientProfile) {
    return ""
  }

  if (clientProfile.fullName?.trim()) {
    return clientProfile.fullName.trim()
  }

  return [clientProfile.firstName, clientProfile.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ")
}

function formatSignedPart(
  signedAt: Date | null | undefined,
  signedTimezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
) {
  if (!signedAt) {
    return ""
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: signedTimezone || "UTC",
      ...options,
    }).format(signedAt)
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(signedAt)
  }
}

export function sanitizeContractTemplateContent(content: string) {
  return sanitizeHtml(normalizeContractTemplateMarkup(content), contractSanitizeOptions).trim()
}

export function renderContractContent(input: RenderContractContentInput) {
  const clientName = buildClientDisplayName(input.clientProfile)
  const signedTimestamp = input.signedAt ? input.signedAt.toISOString() : ""

  const replacements = new Map<string, string>([
    ["{{clientName}}", escapeContractHtml(clientName)],
    ["{{clientFirstName}}", escapeContractHtml(input.clientProfile?.firstName?.trim() || "")],
    ["{{clientLastName}}", escapeContractHtml(input.clientProfile?.lastName?.trim() || "")],
    ["{{clientEmail}}", escapeContractHtml(input.clientProfile?.email || "")],
    ["{{clientPhone}}", escapeContractHtml(input.clientProfile?.phone || "")],
    ["{{clientCompany}}", escapeContractHtml(input.clientProfile?.companyName || "")],
    ["{{clientAddress}}", escapeContractHtml(input.clientProfile?.address || "")],
    ["{{clientCountry}}", escapeContractHtml(input.clientProfile?.country || "")],
    ["{{vendorName}}", escapeContractHtml(input.vendorName || "Vendor")],
    ["{{transactionReference}}", escapeContractHtml(input.transactionReference)],
    ["{{paymentAmount}}", escapeContractHtml(formatMoney(input.amount))],
    ["{{depositAmount}}", escapeContractHtml(formatMoney(input.depositAmount))],
    ["{{signerName}}", escapeContractHtml(input.signerName || "")],
    [
      "{{signedDate}}",
      escapeContractHtml(
        formatSignedPart(input.signedAt, input.signedTimezone, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      ),
    ],
    [
      "{{signedTime}}",
      escapeContractHtml(
        formatSignedPart(input.signedAt, input.signedTimezone, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      ),
    ],
    ["{{signedTimestamp}}", escapeContractHtml(signedTimestamp)],
  ])

  let renderedHtml = normalizeContractTemplateMarkup(input.templateContent)

  for (const [token, value] of replacements.entries()) {
    renderedHtml = renderedHtml.replaceAll(token, value)
  }

  return sanitizeHtml(renderedHtml, contractSanitizeOptions).trim()
}

export function renderContractContentText(input: RenderContractContentInput) {
  return convert(renderContractContent(input), {
    wordwrap: 94,
    preserveNewlines: true,
    selectors: [
      {
        selector: "a",
        options: {
          ignoreHref: true,
        },
      },
    ],
  }).trim()
}
