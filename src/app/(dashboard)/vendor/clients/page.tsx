import { VendorClientsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorClientsPage() {
  const { session } = await requireVendorAccess()
  const workspace = await getVendorWorkspace(session.user.email)

  return <VendorClientsView workspace={workspace} />
}
