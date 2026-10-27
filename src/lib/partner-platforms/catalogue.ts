import { env } from "@/lib/env"

/**
 * Partner platforms a super admin can connect to a vendor account (LYNAEL's own brands). Connecting issues an API key
 * marked for the platform, registers the platform's webhook endpoint and allows its origin, then hands the key and the
 * webhook secret to the platform server to server.
 */
export const PARTNER_PLATFORMS = ["locaz"] as const
export type PartnerPlatform = (typeof PARTNER_PLATFORMS)[number]

export function isPartnerPlatform(value: string): value is PartnerPlatform {
  return (PARTNER_PLATFORMS as readonly string[]).includes(value)
}

export function getPartnerPlatform(platform: PartnerPlatform) {
  const origin = (env.LOCAZ_PLATFORM_ORIGIN ?? "https://www.locaz.co").replace(/\/$/, "")
  return {
    key: platform,
    name: "LOCAZ",
    origin,
    webhookUrl: `${origin}/api/integrations/contrazy/events`,
    provisionUrl: `${origin}/api/integrations/contrazy/provision`,
  }
}
