import { notFound } from "next/navigation"

import { AdminVendorProfileView } from "@/features/dashboard/components/admin-vendor-profile-view"
import { getAdminVendorProfile } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

type AdminVendorManagerTab = "overview" | "transactions" | "subscription" | "access"

function resolveActiveTab(tab: string | undefined): AdminVendorManagerTab {
  switch (tab) {
    case "transactions":
    case "subscription":
    case "access":
      return tab
    default:
      return "overview"
  }
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  await requireAdminAccess()
  const { userId } = await params
  const { tab, page } = await searchParams
  const activeTab = resolveActiveTab(tab)
  const data = await getAdminVendorProfile(userId, {
    activeTab,
    linksPage: page,
    includeSelectedLink: false,
  })

  if (!data) {
    notFound()
  }

  return (
    <AdminVendorProfileView
      data={data}
      activeTab={activeTab}
    />
  )
}
