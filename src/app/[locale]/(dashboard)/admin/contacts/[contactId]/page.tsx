import { notFound } from "next/navigation"

import { AdminContactDetailView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminContactDetail } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export default async function AdminContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  await requireAdminAccess()
  const { contactId } = await params
  const contact = await getAdminContactDetail(contactId)

  if (!contact) notFound()

  return <AdminContactDetailView contact={contact} />
}
