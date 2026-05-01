import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/tarifs", destination: "/pricing", permanent: false },
      { source: "/aide", destination: "/help", permanent: false },
      { source: "/statut", destination: "/status", permanent: false },
      { source: "/cgv", destination: "/legal/terms", permanent: false },
      { source: "/mentions", destination: "/legal/imprint", permanent: false },
      { source: "/mentions-legales", destination: "/legal/imprint", permanent: false },
      { source: "/confidentialite", destination: "/legal/privacy", permanent: false },
      { source: "/privacy", destination: "/legal/privacy", permanent: false },
      { source: "/rgpd", destination: "/legal/gdpr", permanent: false },
      { source: "/connexion", destination: "/login", permanent: false },
      { source: "/inscription", destination: "/register", permanent: false },
      { source: "/forgot", destination: "/forgot-password", permanent: false },
      { source: "/reset", destination: "/reset-password", permanent: false },
      { source: "/verify", destination: "/verify-email", permanent: false },
      { source: "/success", destination: "/signup-success", permanent: false },
      { source: "/dashboard-preview", destination: "/demo", permanent: false },
      { source: "/super-admin", destination: "/admin", permanent: false },
      { source: "/super-admin/:path*", destination: "/admin/:path*", permanent: false },
      { source: "/backoffice", destination: "/admin", permanent: false },
      { source: "/backoffice/:path*", destination: "/admin/:path*", permanent: false },
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/index-back-office.html", destination: "/vendor", permanent: false },
      { source: "/contrazy-backoffice.html", destination: "/admin", permanent: false },
    ]
  },
}

export default nextConfig
