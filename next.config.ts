import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright", "mammoth"],
  outputFileTracingIncludes: {
    "/api/client/*/sign": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/vendor/billing/fee-invoices/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },

  async redirects() {
    return [
      // Auth convenience aliases
      { source: "/forgot", destination: "/en/forgot-password", permanent: true },
      { source: "/reset", destination: "/en/reset-password", permanent: true },
      { source: "/verify", destination: "/en/verify-email", permanent: true },
      { source: "/success", destination: "/en/signup-success", permanent: true },
      { source: "/privacy", destination: "/en/legal/privacy", permanent: true },
      { source: "/:locale(en|fr)/forgot", destination: "/:locale/forgot-password", permanent: true },
      { source: "/:locale(en|fr)/reset", destination: "/:locale/reset-password", permanent: true },
      { source: "/:locale(en|fr)/verify", destination: "/:locale/verify-email", permanent: true },
      { source: "/:locale(en|fr)/success", destination: "/:locale/signup-success", permanent: true },
      { source: "/:locale(en|fr)/privacy", destination: "/:locale/legal/privacy", permanent: true },

      // Admin role routing
      { source: "/super-admin", destination: "/en/admin", permanent: true },
      { source: "/super-admin/:path*", destination: "/en/admin/:path*", permanent: true },
      { source: "/:locale(en|fr)/super-admin", destination: "/:locale/admin", permanent: true },
      { source: "/:locale(en|fr)/super-admin/:path*", destination: "/:locale/admin/:path*", permanent: true },
    ]
  },
}

export default withNextIntl(nextConfig)
