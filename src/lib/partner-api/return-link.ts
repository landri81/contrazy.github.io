import { isReturnUrlAllowed } from "@/lib/partner-api/bookings"

export type PartnerReturnStatus = "completed" | "cancelled"

/**
 * `returnUrl?booking=<externalRef>&status=<completed|cancelled>` for a partner
 * booking, or null when there is nothing safe to link to: no returnUrl, no
 * externalRef, or a returnUrl whose origin is not (or no longer) in the
 * vendor's allowed origins. Existing query parameters are kept.
 */
export function buildPartnerReturnLink(input: {
  source: string
  returnUrl: string | null | undefined
  externalRef: string | null | undefined
  allowedOrigins: readonly string[] | null | undefined
  status: PartnerReturnStatus
}): string | null {
  if (input.source !== "PARTNER_API" || !input.returnUrl || !input.externalRef) {
    return null
  }

  if (!isReturnUrlAllowed(input.returnUrl, input.allowedOrigins ?? [])) {
    return null
  }

  const url = new URL(input.returnUrl)
  url.searchParams.set("booking", input.externalRef)
  url.searchParams.set("status", input.status)
  return url.toString()
}

export type PartnerReturnTarget = {
  href: string
  partnerName: string
}

type ReturnLinkTransaction = {
  source: string
  returnUrl: string | null
  externalRef: string | null
  vendor: { businessName: string | null; partnerAllowedOrigins: readonly string[] } | null
  link?: { cancelledBy: string | null } | null
}

/**
 * What the customer completion / cancelled screens need to show the
 * "Return to <partner>" button, or null when it must not be shown. A
 * cancelled booking only links back when the customer cancelled it; a
 * vendor, partner or expiry cancellation keeps the regular cancelled screen.
 */
export function resolvePartnerReturnTarget(
  transaction: ReturnLinkTransaction,
  status: PartnerReturnStatus
): PartnerReturnTarget | null {
  if (status === "cancelled" && transaction.link?.cancelledBy !== "CLIENT") {
    return null
  }

  const href = buildPartnerReturnLink({
    source: transaction.source,
    returnUrl: transaction.returnUrl,
    externalRef: transaction.externalRef,
    allowedOrigins: transaction.vendor?.partnerAllowedOrigins,
    status,
  })

  if (!href) {
    return null
  }

  return { href, partnerName: transaction.vendor?.businessName?.trim() || new URL(href).hostname }
}
