import { env } from "@/lib/env"

export function getSiteUrl() {
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL
  }

  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return env.VERCEL_PROJECT_PRODUCTION_URL.startsWith("http")
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (env.VERCEL_URL) {
    return env.VERCEL_URL.startsWith("http") ? env.VERCEL_URL : `https://${env.VERCEL_URL}`
  }

  return "http://localhost:3000"
}
