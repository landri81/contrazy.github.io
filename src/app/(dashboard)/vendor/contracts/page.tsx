export const dynamic = "force-dynamic"

import { getContractTemplateLimit, getContractTemplateLimitReachedMessage } from "@/features/subscriptions/server/feature-gates"
import { getVendorStatusMessage, isVendorPreparationAllowed, requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { resolvePagination } from "@/lib/pagination"
import { ContractTemplateList } from "@/features/dashboard/components/contract-template-list"
import { PaginationControls } from "@/features/dashboard/components/dashboard-ui"

const PAGE_SIZE = 12

export default async function VendorContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { vendorProfile, subscription } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const templateLimit = getContractTemplateLimit(subscription)
  const templateLimitMessage = templateLimit !== null ? getContractTemplateLimitReachedMessage(templateLimit) : null

  const [templates, totalCount] = await Promise.all([
    prisma.contractTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: PAGE_SIZE,
    }),
    prisma.contractTemplate.count({ where: { vendorId: vendorProfile.id } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contract Templates</h1>
        <p className="text-muted-foreground mt-2">
          Manage the agreement language used in your transactions and add merge fields for customer or payment details.
        </p>
      </div>

      <ContractTemplateList
        initialTemplates={templates}
        initialTotalCount={totalCount}
        canEdit={isVendorPreparationAllowed(vendorProfile)}
        blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
        templateLimit={templateLimit}
        templateLimitMessage={templateLimitMessage}
      />

      <PaginationControls
        currentPage={pagination.page}
        totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/vendor/contracts"
      />
    </div>
  )
}
