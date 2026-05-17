import { notFound } from "next/navigation"

import { VendorDisputeDetailView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorDisputeDetail } from "@/features/dashboard/server/dashboard-data"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export default async function VendorDisputeDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>
}) {
  const { session } = await requireSubscribedVendorProfileAccess()
  const { transactionId } = await params
  const dispute = await getVendorDisputeDetail(session.user.email, transactionId)

  if (!dispute) notFound()

  return <VendorDisputeDetailView dispute={dispute} />
}
