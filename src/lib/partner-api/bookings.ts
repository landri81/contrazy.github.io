import type { TransactionLinkStatus, TransactionStatus } from "@prisma/client"

export const DEFAULT_BOOKING_TIMEZONE = "Europe/Paris"

const IANA_TIMEZONE_PATTERN = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/

/** IANA zone names only (e.g. `Europe/Paris`, `UTC`); abbreviations such as `CET` are refused. */
export function isValidIanaTimezone(value: string) {
  if (!IANA_TIMEZONE_PATTERN.test(value)) {
    return false
  }

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Calendar date (`YYYY-MM-DD`) of an instant as seen in the booking timezone. */
export function getDatePartInTimezone(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""

  return `${read("year")}-${read("month")}-${read("day")}`
}

/**
 * `Transaction.serviceDate` is a date-only column read by the existing screens.
 * Partner bookings fill it with the local date part of `startAt`.
 */
export function serviceDateFromStartAt(startAt: Date, timezone: string) {
  return new Date(`${getDatePartInTimezone(startAt, timezone)}T00:00:00.000Z`)
}

export function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.trim())

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

/** Exact origin match (scheme + host + port) against the vendor allow-list. */
export function isReturnUrlAllowed(returnUrl: string, allowedOrigins: readonly string[]) {
  const origin = normalizeOrigin(returnUrl)

  if (!origin) {
    return false
  }

  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === origin)
}

export type PartnerCustomerLocale = "fr" | "en" | "it"

/**
 * The Contrazy client flow speaks `en` and `fr`. Italian customers get the
 * English flow until an Italian translation exists.
 */
export function resolveFlowLocale(locale: PartnerCustomerLocale): "en" | "fr" {
  return locale === "fr" ? "fr" : "en"
}

const UNLOCKED_TRANSACTION_STATUSES = new Set<TransactionStatus>(["DRAFT", "LINK_SENT"])

export type BookingLockSnapshot = {
  status: TransactionStatus
  link: { status: TransactionLinkStatus; openedAt: Date | null } | null
}

/**
 * A booking can be changed only until the customer starts: once the secure
 * link was opened, or the transaction moved past `LINK_SENT`, it is locked.
 */
export function isBookingLocked(snapshot: BookingLockSnapshot) {
  if (!UNLOCKED_TRANSACTION_STATUSES.has(snapshot.status)) {
    return true
  }

  if (!snapshot.link) {
    return false
  }

  return Boolean(snapshot.link.openedAt) || snapshot.link.status !== "ACTIVE"
}
