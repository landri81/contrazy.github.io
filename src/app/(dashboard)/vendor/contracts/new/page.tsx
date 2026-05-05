export const dynamic = "force-dynamic"

import {
  getContractTemplateLimit,
  getContractTemplateLimitReachedMessage,
} from "@/features/subscriptions/server/feature-gates"
import {
  getVendorStatusMessage,
  isVendorPreparationAllowed,
  requireSubscribedVendorProfileAccess,
} from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ContractTemplateEditor } from "@/features/dashboard/components/contract-template-editor"

export default async function VendorContractTemplateCreatePage() {
  const { vendorProfile, subscription } = await requireSubscribedVendorProfileAccess()

  const templateLimit = getContractTemplateLimit(subscription)
  const templateLimitMessage =
    templateLimit !== null
      ? getContractTemplateLimitReachedMessage(templateLimit)
      : null

  const templateCount = await prisma.contractTemplate.count({
    where: { vendorId: vendorProfile.id },
  })

  return (
    <ContractTemplateEditor
      mode="create"
      canEdit={isVendorPreparationAllowed(vendorProfile)}
      blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      templateLimit={templateLimit}
      templateCount={templateCount}
      templateLimitMessage={templateLimitMessage}
    />
  )
}
