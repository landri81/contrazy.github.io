import createMiddleware from "next-intl/middleware"
import { getToken } from "next-auth/jwt"
import { type NextRequest, NextResponse } from "next/server"

import { canAccessAdminScope, canAccessVendorScope, type UserRole } from "@/lib/auth/roles"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

// Strips the locale prefix to get the bare path for auth decisions.
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/"
    }
  }
  return pathname
}

// Resolves the active locale from the pathname, or returns the default.
function resolveLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through API routes, static assets, and Next internals untouched.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    /\.(ico|png|jpg|jpeg|svg|webmanifest|txt|xml)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Always land the bare domain on French, regardless of stored locale or browser preference.
  if (pathname === "/") {
    const url = req.nextUrl.clone()
    url.pathname = `/${routing.defaultLocale}`
    return NextResponse.redirect(url)
  }

  const barePath = stripLocale(pathname)
  const locale = resolveLocale(pathname)

  const needsAuth =
    barePath.startsWith("/vendor") ||
    barePath.startsWith("/admin") ||
    barePath.startsWith("/super-admin") ||
    barePath.startsWith("/backoffice")

  if (needsAuth) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
      const loginUrl = new URL(`/${locale}/login`, req.url)
      loginUrl.searchParams.set("callbackUrl", req.url)
      return NextResponse.redirect(loginUrl)
    }

    const role = token.role as UserRole | undefined

    if (
      (barePath.startsWith("/admin") ||
        barePath.startsWith("/super-admin") ||
        barePath.startsWith("/backoffice")) &&
      !canAccessAdminScope(role)
    ) {
      return NextResponse.redirect(new URL(`/${locale}/vendor`, req.url))
    }

    if (barePath.startsWith("/vendor") && !canAccessVendorScope(role)) {
      return NextResponse.redirect(new URL(`/${locale}/login`, req.url))
    }
  }

  return intlMiddleware(req)
}

export const config = {
  matcher: [
    // Match everything except API routes, Next internals, and static files.
    "/((?!api|_next/static|_next/image|favicon\\.ico|apple-icon|icon\\.).*)",
  ],
}
