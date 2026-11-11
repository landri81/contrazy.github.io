import { prisma } from "@/lib/db/prisma"

/**
 * The vendor's contract templates for a partner (LOCAZ, 11 Nov 2026: one contract per vehicle type): their name and
 * whether each is the default, never their text. The partner picks one per booking with `contractTemplateId`; without
 * it the vendor's default applies.
 */
export type PartnerContractTemplate = { id: string; name: string; description: string | null; isDefault: boolean; updatedAt: string }

export async function listPartnerContractTemplates(vendorId: string): Promise<PartnerContractTemplate[]> {
  const rows = await prisma.contractTemplate.findMany({
    where: { vendorId },
    select: { id: true, name: true, description: true, isDefault: true, updatedAt: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, isDefault: row.isDefault, updatedAt: row.updatedAt.toISOString() }))
}
