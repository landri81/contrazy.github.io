import { notFound } from "next/navigation"

import { AdminVendorLinkDetailView } from "@/features/dashboard/components/admin-vendor-profile-view"
import { getAdminVendorProfile } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminUserLinkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; linkId: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { session } = await requireAdminAccess()
  const { userId, linkId } = await params
  const { page } = await searchParams

  const data = await getAdminVendorProfile(userId, {
    activeTab: "transactions",
    selectedLinkId: linkId,
    includeLinksList: false,
    includeSelectedLink: true,
  })

  if (!data || !data.selectedLink) {
    notFound()
  }

  return (
    <AdminVendorLinkDetailView
      data={data}
      page={page}
      canDeleteDocuments={session.user.role === "SUPER_ADMIN"}
    />
  )
}
