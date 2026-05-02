import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
      { source: "/forgot", destination: "/forgot-password", permanent: true },
      { source: "/reset", destination: "/reset-password", permanent: true },
      { source: "/verify", destination: "/verify-email", permanent: true },
      { source: "/success", destination: "/signup-success", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },

      // Admin role routing
      { source: "/super-admin", destination: "/admin", permanent: true },
      { source: "/super-admin/:path*", destination: "/admin/:path*", permanent: true },
    ]
  },
}

export default nextConfig
