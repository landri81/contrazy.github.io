export const dynamic = "force-dynamic"

import { PartnerApiKeysManager } from "@/features/partner-api/components/partner-api-keys-manager"
import {
  listPartnerApiKeys,
  PARTNER_API_KEY_PAGE_SIZE,
  resolvePartnerApiKeyMode,
  type PartnerApiKeyListPage,
} from "@/features/partner-api/server/api-keys"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorApiKeysPage() {
  const { dbUser, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const isOwner = vendorProfile.userId === dbUser.id

  let initialData: PartnerApiKeyListPage | null = null

  try {
    initialData = await listPartnerApiKeys(vendorProfile.id, 1, PARTNER_API_KEY_PAGE_SIZE)
  } catch (error) {
    console.error("Partner API keys page load failed", error instanceof Error ? error.message : error)
  }

  return (
    <PartnerApiKeysManager
      initialData={initialData}
      canManage={isOwner}
      mode={resolvePartnerApiKeyMode(process.env.STRIPE_SECRET_KEY)}
    />
  )
}
