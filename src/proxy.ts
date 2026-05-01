import { withAuth } from "next-auth/middleware"

import { canAccessAdminScope, canAccessVendorScope } from "@/lib/auth/roles"

export default withAuth(
  function proxy() {
    return
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname

        if (!token) {
          return false
        }

        if (pathname.startsWith("/admin") || pathname.startsWith("/super-admin") || pathname.startsWith("/backoffice")) {
          return canAccessAdminScope(token.role)
        }

        if (pathname.startsWith("/vendor")) {
          return canAccessVendorScope(token.role)
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/super-admin/:path*", "/backoffice/:path*"],
}
