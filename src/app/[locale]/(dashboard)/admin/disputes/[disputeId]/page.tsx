import { notFound } from "next/navigation"

import { AdminDisputeDetailView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminDisputeDetail } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>
}) {
  await requireAdminAccess()
  const { disputeId } = await params
  const dispute = await getAdminDisputeDetail(disputeId)

  if (!dispute) notFound()

  return <AdminDisputeDetailView dispute={dispute} />
}
