import { VendorSignaturesView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorSignaturesPage() {
  const { session } = await requireVendorAccess()
  const workspace = await getVendorWorkspace(session.user.email)

  return <VendorSignaturesView workspace={workspace} />
}
