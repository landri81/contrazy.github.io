export const dynamic = "force-dynamic"

import { getContractTemplateLimit, getContractTemplateLimitReachedMessage } from "@/features/subscriptions/server/feature-gates"
import { getVendorStatusMessage, isVendorPreparationAllowed, requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ContractTemplateList } from "@/features/dashboard/components/contract-template-list"
import { CONTRACT_TEMPLATE_PAGE_SIZE } from "@/features/contracts/template-listing"

export default async function VendorContractsPage() {
  const { vendorProfile, subscription } = await requireSubscribedVendorProfileAccess()
  const templateLimit = getContractTemplateLimit(subscription)
  const templateLimitMessage = templateLimit !== null ? getContractTemplateLimitReachedMessage(templateLimit) : null

  const [templates, totalCount] = await Promise.all([
    prisma.contractTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { updatedAt: "desc" },
      take: CONTRACT_TEMPLATE_PAGE_SIZE,
    }),
    prisma.contractTemplate.count({ where: { vendorId: vendorProfile.id } }),
  ])

  return (
    <ContractTemplateList
      initialTemplates={templates}
      initialTotalCount={totalCount}
      initialPageSize={CONTRACT_TEMPLATE_PAGE_SIZE}
      canEdit={isVendorPreparationAllowed(vendorProfile)}
      blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      templateLimit={templateLimit}
      templateLimitMessage={templateLimitMessage}
    />
  )
}
