import type { Prisma, PrismaClient } from "@prisma/client"

import locazRentalContract from "@/features/contracts/templates/locaz-rental-contract.json"

/**
 * Default "LOCAZ rental contract" template (FR + EN, synthetic text, legal
 * review pending). The same JSON file is read by
 * `scripts/seed-locaz-rental-template.mjs`.
 */
export const LOCAZ_RENTAL_CONTRACT_TEMPLATE = locazRentalContract
export const LOCAZ_RENTAL_CONTRACT_TEMPLATE_NAME = locazRentalContract.name

type TemplateDb = Pick<PrismaClient | Prisma.TransactionClient, "contractTemplate">

/** Creates the template for a vendor once; later calls return the existing row unchanged. */
export async function seedLocazRentalContractTemplate(db: TemplateDb, vendorId: string) {
  const existing = await db.contractTemplate.findFirst({
    where: { vendorId, name: LOCAZ_RENTAL_CONTRACT_TEMPLATE_NAME },
    orderBy: { createdAt: "asc" },
  })

  if (existing) {
    return { created: false as const, template: existing }
  }

  const template = await db.contractTemplate.create({
    data: {
      vendorId,
      name: LOCAZ_RENTAL_CONTRACT_TEMPLATE.name,
      description: LOCAZ_RENTAL_CONTRACT_TEMPLATE.description,
      content: LOCAZ_RENTAL_CONTRACT_TEMPLATE.content,
    },
  })

  return { created: true as const, template }
}
