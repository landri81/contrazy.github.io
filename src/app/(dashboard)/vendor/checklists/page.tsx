export const dynamic = "force-dynamic"

import { getVendorStatusMessage, isVendorPreparationAllowed, requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { resolvePagination } from "@/lib/pagination"
import { ChecklistTemplateList } from "@/features/dashboard/components/checklist-template-list"
import { PaginationControls } from "@/features/dashboard/components/dashboard-ui"

const PAGE_SIZE = 12

export default async function VendorChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })

  const [templates, totalCount] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: PAGE_SIZE,
    }),
    prisma.checklistTemplate.count({ where: { vendorId: vendorProfile.id } }),
  ])

  return (
    <div className="space-y-6">
      <div className="mb-4 bg-white p-4 rounded-md shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Requirement Checklists</h1>
        <p className="text-muted-foreground mt-2">
          Create templates for the documents or photos clients must upload during a transaction.
        </p>
      </div>

      <div className="bg-white p-4 rounded-md shadow-sm">
        <ChecklistTemplateList
          initialTemplates={templates}
          canEdit={isVendorPreparationAllowed(vendorProfile)}
          blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
        />
      </div>

      <PaginationControls
        currentPage={pagination.page}
        totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/vendor/checklists"
      />
    </div>
  )
}
