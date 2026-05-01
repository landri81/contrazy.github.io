import { VendorLinksView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorLinksPage() {
  const { session } = await requireVendorAccess()
  const workspace = await getVendorWorkspace(session.user.email)

  return <VendorLinksView workspace={workspace} />
}
