export function parseDateOnlyInput(value: string) {
  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toDateOnlyInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
  }

  if (Number.isNaN(value.getTime())) {
    return ""
  }

  return value.toISOString().slice(0, 10)
}

export function formatDateOnlyValue(
  value: Date | string | null | undefined,
  locale: string | null | undefined
) {
  const input = toDateOnlyInputValue(value)

  if (!input) {
    return ""
  }

  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${input}T00:00:00.000Z`))
  } catch {
    return input
  }
}
