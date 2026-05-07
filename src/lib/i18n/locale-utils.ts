import { routing, type Locale } from "@/i18n/routing"

/** Normalises any string to a valid Locale, falling back to the default. */
export function normalizeLocale(value: string | null | undefined): Locale {
  if (value && (routing.locales as readonly string[]).includes(value)) {
    return value as Locale
  }
  return routing.defaultLocale
}

/** Prepends a locale prefix to a bare path like "/vendor". */
export function withLocalePath(locale: Locale, path: string): string {
  const bare = path.startsWith("/") ? path : `/${path}`
  return `/${locale}${bare === "/" ? "" : bare}`
}

/** Extracts the locale segment from a pathname that begins with "/{locale}/…". */
export function getLocaleFromPathname(pathname: string): Locale {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
}

export function getLocaleFromUrl(value: string | URL | null | undefined): Locale {
  if (!value) {
    return routing.defaultLocale
  }

  try {
    const url = typeof value === "string" ? new URL(value, "http://localhost") : value
    return getLocaleFromPathname(url.pathname)
  } catch {
    return routing.defaultLocale
  }
}

export function resolveRequestLocale(
  request: Pick<Request, "url" | "headers">,
  fallback?: string | null
): Locale {
  const directLocale = getLocaleFromUrl(request.url)
  if (directLocale !== routing.defaultLocale || getLocaleFromPathname(new URL(request.url).pathname) !== routing.defaultLocale) {
    return directLocale
  }

  const referer = request.headers.get("referer")
  if (referer) {
    const refererLocale = getLocaleFromUrl(referer)
    if (refererLocale) {
      return refererLocale
    }
  }

  return normalizeLocale(fallback)
}

/** Builds a fully-qualified URL for an app page including locale. */
export function toAbsoluteLocalizedAppUrl(
  siteUrl: string,
  locale: Locale,
  path: string
): string {
  const bare = path.startsWith("/") ? path : `/${path}`
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl
  return `${base}/${locale}${bare === "/" ? "" : bare}`
}
