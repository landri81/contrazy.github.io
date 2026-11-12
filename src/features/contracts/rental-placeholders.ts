import { escapeContractHtml } from "@/features/contracts/contract-content"
import { parseRentalDetails, type RentalDetails } from "@/features/partner-api/schemas/booking.schema"

/**
 * Rental data used by the `{{rental.*}}` contract placeholders. It is read from
 * the transaction columns written by the partner bookings API.
 */
export type ContractRentalContext = {
  rentalDetails: unknown
  startAt: Date | string | null
  endAt: Date | string | null
  timezone: string | null
  currency?: string | null
}

export const RENTAL_PLACEHOLDER_TOKENS = [
  "{{rental.vehicle}}",
  "{{rental.plate}}",
  "{{rental.start}}",
  "{{rental.end}}",
  "{{rental.pickupPlace}}",
  "{{rental.returnPlace}}",
  "{{rental.kmIncluded}}",
  "{{rental.options}}",
  "{{rental.protection}}",
  "{{rental.deductible}}",
  "{{rental.deposit}}",
  "{{rental.priceTable}}",
  "{{rental.departureKm}}",
  "{{rental.departureFuel}}",
  "{{rental.departureAt}}",
  "{{rental.departureDamages}}",
  "{{rental.departureReport}}",
  "{{rental.lessorPhone}}",
  "{{rental.assistancePhone}}",
  "{{rental.category}}",
  "{{rental.fuel}}",
  "{{rental.mainDriverLicence}}",
  "{{rental.extraDrivers}}",
  "{{rental.companyName}}",
  "{{rental.companySiret}}",
  "{{rental.companyVat}}",
  "{{rental.termsLink}}",
  "{{rental.lateFee}}",
] as const

type RentalLocale = "en" | "fr"

const copy = {
  en: {
    unlimited: "Unlimited mileage",
    perExtraKm: "per extra km",
    total: "Total",
    noDamage: "None reported",
    departureReport: "Departure check of {at}: mileage {km}, fuel {fuel}. Damage noted: {damages}.",
    noExtraDriver: "No additional driver authorised.",
    licence: "licence no. {number}",
  },
  fr: {
    unlimited: "Kilométrage illimité",
    perExtraKm: "par km supplémentaire",
    total: "Total",
    noDamage: "Aucun dommage signalé",
    departureReport: "État des lieux de départ du {at} : kilométrage {km}, carburant {fuel}. Dommages constatés : {damages}.",
    noExtraDriver: "Aucun conducteur secondaire autorisé.",
    licence: "permis n° {number}",
  },
} satisfies Record<RentalLocale, Record<string, string>>

function resolveLocale(locale: string | null | undefined): RentalLocale {
  return locale?.trim().toLowerCase() === "fr" ? "fr" : "en"
}

function intlLocale(locale: RentalLocale) {
  return locale === "fr" ? "fr-FR" : "en-GB"
}

/** Intl uses narrow/no-break spaces in fr output; plain spaces keep PDF fonts happy. */
function normalizeSpaces(value: string) {
  return value.replace(/[  ]/g, " ")
}

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatRentalDateTime(
  value: Date | string | null | undefined,
  timezone: string | null | undefined,
  locale: string | null | undefined
) {
  const date = toDate(value)

  if (!date) {
    return ""
  }

  const resolvedLocale = resolveLocale(locale)
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }

  try {
    const zone = timezone || "UTC"
    const formatted = new Intl.DateTimeFormat(intlLocale(resolvedLocale), { ...options, timeZone: zone }).format(date)
    return normalizeSpaces(`${formatted} (${zone})`)
  } catch {
    return normalizeSpaces(`${new Intl.DateTimeFormat(intlLocale(resolvedLocale), { ...options, timeZone: "UTC" }).format(date)} (UTC)`)
  }
}

export function formatRentalMoney(amount: number | null | undefined, currency: string | null | undefined, locale: string | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return ""
  }

  try {
    return normalizeSpaces(
      new Intl.NumberFormat(intlLocale(resolveLocale(locale)), {
        style: "currency",
        currency: currency || "EUR",
      }).format(amount / 100)
    )
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency || "EUR"}`
  }
}

function formatPlace(place: RentalDetails["pickup"]) {
  return place.address ? `${place.place}, ${place.address}` : place.place
}

function formatMileage(rental: RentalDetails, currency: string, locale: RentalLocale) {
  if (rental.mileage.unlimited) {
    return copy[locale].unlimited
  }

  const km = `${normalizeSpaces(new Intl.NumberFormat(intlLocale(locale)).format(rental.mileage.includedKm ?? 0))} km`

  if (typeof rental.mileage.extraKmPrice !== "number") {
    return km
  }

  return `${km} (${formatRentalMoney(rental.mileage.extraKmPrice, currency, locale)} ${copy[locale].perExtraKm})`
}

function formatQuantity(quantity: number, locale: RentalLocale) {
  return normalizeSpaces(new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(quantity))
}

/** "Label : 15,00 €" in French, "Label: €15.00" in English. */
function labelled(label: string, value: string, locale: RentalLocale) {
  return `${label}${locale === "fr" ? " : " : ": "}${value}`
}

function buildPriceLineTexts(rental: RentalDetails, currency: string, locale: RentalLocale) {
  return rental.priceLines.map((line) => {
    // One unit with no unit of its own (the partner put the detail in the label, e.g. LOCAZ): just the amount.
    if (line.quantity === 1 && (!line.unit || line.unit === "item")) return labelled(line.label, formatRentalMoney(line.total, currency, locale), locale)
    const quantity = `${formatQuantity(line.quantity, locale)}${line.unit ? ` ${line.unit}` : ""}`
    return `${line.label} — ${quantity} × ${formatRentalMoney(line.unitAmount, currency, locale)} = ${formatRentalMoney(line.total, currency, locale)}`
  })
}

function buildPriceTotalText(rental: RentalDetails, currency: string, locale: RentalLocale) {
  const total = rental.priceLines.reduce((sum, line) => sum + line.total, 0)
  return labelled(copy[locale].total, formatRentalMoney(total, currency, locale), locale)
}

/** Plain-text values for every rental placeholder (empty strings when the data is missing). */
export function buildRentalPlaceholderValues(
  context: ContractRentalContext | null | undefined,
  locale: string | null | undefined
): Record<(typeof RENTAL_PLACEHOLDER_TOKENS)[number], string> {
  const resolvedLocale = resolveLocale(locale)
  const rental = parseRentalDetails(context?.rentalDetails)
  const currency = context?.currency || "EUR"

  const priceLines = rental ? buildPriceLineTexts(rental, currency, resolvedLocale) : []

  return {
    "{{rental.vehicle}}": rental
      ? [rental.vehicle.model, rental.vehicle.category ? `(${rental.vehicle.category})` : ""].filter(Boolean).join(" ")
      : "",
    "{{rental.plate}}": rental?.vehicle.plate ?? "",
    "{{rental.start}}": formatRentalDateTime(context?.startAt, context?.timezone, resolvedLocale),
    "{{rental.end}}": formatRentalDateTime(context?.endAt, context?.timezone, resolvedLocale),
    "{{rental.pickupPlace}}": rental ? formatPlace(rental.pickup) : "",
    "{{rental.returnPlace}}": rental ? formatPlace(rental.return) : "",
    "{{rental.kmIncluded}}": rental ? formatMileage(rental, currency, resolvedLocale) : "",
    "{{rental.options}}": rental ? rental.options.join(", ") : "",
    "{{rental.protection}}": rental?.protection ?? "",
    "{{rental.deductible}}": rental ? formatRentalMoney(rental.deductible, currency, resolvedLocale) : "",
    "{{rental.deposit}}": rental ? formatRentalMoney(rental.deposit, currency, resolvedLocale) : "",
    "{{rental.priceTable}}":
      rental && priceLines.length > 0
        ? [...priceLines, buildPriceTotalText(rental, currency, resolvedLocale)].join("; ")
        : "",
    // The vehicle as handed over (check-in readings of a contract signed at pickup); empty until the partner sends them.
    "{{rental.departureKm}}": rental?.departure
      ? `${normalizeSpaces(new Intl.NumberFormat(intlLocale(resolvedLocale)).format(rental.departure.odometerKm))} km`
      : "",
    "{{rental.departureFuel}}": rental?.departure ? `${rental.departure.fuelEighths}/8` : "",
    "{{rental.departureAt}}": rental?.departure ? formatRentalDateTime(rental.departure.inspectedAt, context?.timezone, resolvedLocale) : "",
    "{{rental.departureDamages}}": rental?.departure ? rental.departure.damages || copy[resolvedLocale].noDamage : "",
    // The check-in readings in one sentence (LOCAZ, 9 Nov 2026): a contract signed at booking has none, so its paragraph goes.
    "{{rental.departureReport}}": rental?.departure
      ? copy[resolvedLocale].departureReport
          .replace("{at}", formatRentalDateTime(rental.departure.inspectedAt, context?.timezone, resolvedLocale))
          .replace("{km}", `${normalizeSpaces(new Intl.NumberFormat(intlLocale(resolvedLocale)).format(rental.departure.odometerKm))} km`)
          .replace("{fuel}", `${rental.departure.fuelEighths}/8`)
          .replace("{damages}", rental.departure.damages || copy[resolvedLocale].noDamage)
      : "",
    "{{rental.lessorPhone}}": rental?.lessorPhone ?? "",
    "{{rental.assistancePhone}}": rental?.assistancePhone ?? "",
    // The contract's own fields for the vehicle, the drivers and the renting company (LOCAZ, 12 Nov 2026).
    "{{rental.category}}": rental?.vehicle.category ?? "",
    "{{rental.fuel}}": rental?.vehicle.fuel ?? "",
    "{{rental.mainDriverLicence}}": rental?.drivers?.mainLicenceNumber ?? "",
    "{{rental.extraDrivers}}": rental?.drivers ? formatExtraDrivers(rental.drivers.extra, resolvedLocale) : "",
    "{{rental.companyName}}": rental?.company?.name ?? "",
    "{{rental.companySiret}}": rental?.company?.siret ?? "",
    "{{rental.companyVat}}": rental?.company?.vatNumber ?? "",
    "{{rental.termsLink}}": rental?.termsUrl ?? "",
    "{{rental.lateFee}}": rental?.lateFee ?? "",
  }
}

/** "Marie Durand (permis n° 12AB34567)" per extra driver; the sentence saying none when the partner sent an empty list. */
function formatExtraDrivers(drivers: NonNullable<RentalDetails["drivers"]>["extra"], locale: RentalLocale) {
  if (drivers.length === 0) return copy[locale].noExtraDriver
  return drivers
    .map((driver) => {
      const name = `${driver.firstName} ${driver.lastName}`
      return driver.licenceNumber ? `${name} (${copy[locale].licence.replace("{number}", driver.licenceNumber)})` : name
    })
    .join("; ")
}

/** Price lines as a list block; lists render the same in the viewer, the print page and the PDF fallback. */
function buildPriceTableHtml(context: ContractRentalContext | null | undefined, locale: string | null | undefined) {
  const resolvedLocale = resolveLocale(locale)
  const rental = parseRentalDetails(context?.rentalDetails)

  if (!rental || rental.priceLines.length === 0) {
    return ""
  }

  const currency = context?.currency || "EUR"
  const items = buildPriceLineTexts(rental, currency, resolvedLocale)
    .map((text) => `<li>${escapeContractHtml(text)}</li>`)
    .join("")

  return `<ul>${items}<li><strong>${escapeContractHtml(buildPriceTotalText(rental, currency, resolvedLocale))}</strong></li></ul>`
}

const STANDALONE_PRICE_TABLE_PATTERN = /<p[^>]*>\s*\{\{\s*rental\.priceTable\s*\}\}\s*<\/p>/gi
const STANDALONE_DEPARTURE_REPORT_PATTERN = /<p[^>]*>\s*\{\{\s*rental\.departureReport\s*\}\}\s*<\/p>/gi

/** Replaces the `{{rental.*}}` tokens in template HTML. Unknown rental tokens are left for the caller to clear. */
export function applyRentalPlaceholders(
  html: string,
  context: ContractRentalContext | null | undefined,
  locale: string | null | undefined
) {
  const values = buildRentalPlaceholderValues(context, locale)
  let rendered = html.replace(STANDALONE_PRICE_TABLE_PATTERN, () => buildPriceTableHtml(context, locale))
  // No check-in yet (a contract signed at booking): the readings' paragraph is left out, not printed empty.
  if (!values["{{rental.departureReport}}"]) rendered = rendered.replace(STANDALONE_DEPARTURE_REPORT_PATTERN, "")
  // The terms as a link the signer can open, not only their address in the text.
  const termsUrl = values["{{rental.termsLink}}"]
  if (termsUrl) rendered = rendered.replaceAll("{{rental.termsLink}}", `<a href="${escapeContractHtml(termsUrl)}">${escapeContractHtml(termsUrl)}</a>`)

  for (const token of RENTAL_PLACEHOLDER_TOKENS) {
    rendered = rendered.replaceAll(token, escapeContractHtml(values[token]))
  }

  return rendered
}

const UNKNOWN_PLACEHOLDER_PATTERN = /\{\{\s*[A-Za-z][\w.-]*\s*\}\}/g

/** Any `{{token}}` still present after rendering is unknown: it renders empty. */
export function clearUnknownPlaceholders(html: string) {
  return html.replace(UNKNOWN_PLACEHOLDER_PATTERN, "")
}

/** Picks the rental context from a transaction row (the columns are null for dashboard transactions). */
export function buildContractRentalContext(transaction: {
  rentalDetails?: unknown
  startAt?: Date | null
  endAt?: Date | null
  timezone?: string | null
  currency?: string | null
}): ContractRentalContext {
  return {
    rentalDetails: transaction.rentalDetails ?? null,
    startAt: transaction.startAt ?? null,
    endAt: transaction.endAt ?? null,
    timezone: transaction.timezone ?? null,
    currency: transaction.currency ?? null,
  }
}
