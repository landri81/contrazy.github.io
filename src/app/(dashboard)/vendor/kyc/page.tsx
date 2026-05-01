import { VendorKycView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorKycPage() {
  const { session } = await requireVendorAccess()
  const workspace = await getVendorWorkspace(session.user.email)

  return <VendorKycView workspace={workspace} />
}
