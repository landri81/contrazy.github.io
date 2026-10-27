import { prisma } from "@/lib/db/prisma"

/**
 * Makes this template the vendor's default: the contract a partner platform's booking (LOCAZ) uses when it asks for a
 * contract without naming a template. A vendor has one default, so the others lose the mark in the same transaction.
 * Returns null when the template is not this vendor's.
 */
export async function setDefaultContractTemplate(vendorId: string, templateId: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.contractTemplate.findFirst({ where: { id: templateId, vendorId } })
    if (!template) return null

    await tx.contractTemplate.updateMany({ where: { vendorId, isDefault: true, NOT: { id: templateId } }, data: { isDefault: false } })
    if (template.isDefault) return template

    const updated = await tx.contractTemplate.update({ where: { id: templateId }, data: { isDefault: true } })
    await tx.auditLog.create({
      data: { actorId, action: "contract_template.set_default", entityType: "ContractTemplate", entityId: templateId, metadata: { vendorId, name: template.name } },
    })
    return updated
  })
}
