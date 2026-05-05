export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"

import { ContractTemplateEditor } from "@/features/dashboard/components/contract-template-editor"
import {
  getVendorStatusMessage,
  isVendorPreparationAllowed,
  requireSubscribedVendorProfileAccess,
} from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export default async function VendorContractTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { vendorProfile } = await requireSubscribedVendorProfileAccess()

  const template = await prisma.contractTemplate.findFirst({
    where: {
      id,
      vendorId: vendorProfile.id,
    },
  })

  if (!template) {
    notFound()
  }

  return (
    <ContractTemplateEditor
      mode="edit"
      initialTemplate={template}
      canEdit={isVendorPreparationAllowed(vendorProfile)}
      blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
    />
  )
}
