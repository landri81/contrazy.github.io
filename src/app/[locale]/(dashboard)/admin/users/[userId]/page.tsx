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
  searchParams: Promise<{
    tab?: string
    page?: string
    q?: string
    linkStatus?: string
    transactionStatus?: string
    kind?: string
  }>
}) {
  await requireAdminAccess()
  const { userId } = await params
  const { tab, page, q, linkStatus, transactionStatus, kind } = await searchParams
  const activeTab = resolveActiveTab(tab)
  const data = await getAdminVendorProfile(userId, {
    activeTab,
    linksPage: page,
    linksFilters: {
      q,
      linkStatus,
      transactionStatus,
      kind,
    },
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
