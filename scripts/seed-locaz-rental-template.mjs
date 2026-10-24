/**
 * Seeds the default "LOCAZ rental contract" template (FR + EN, synthetic text,
 * legal review pending) for one vendor. Idempotent: a vendor that already has
 * a template with that name is left unchanged.
 *
 * Usage: npm run locaz:seed-contract-template -- --vendor <vendorProfileId | owner email>
 */
import { readFileSync } from "node:fs"

import { PrismaClient } from "@prisma/client"

import { ensureDatabaseEnv, isDirectRun } from "./process-utils.mjs"

const templateUrl = new URL("../src/features/contracts/templates/locaz-rental-contract.json", import.meta.url)

function readVendorArgument(argv) {
  const index = argv.indexOf("--vendor")
  const value = index >= 0 ? argv[index + 1] : argv.find((item) => item.startsWith("--vendor="))?.slice("--vendor=".length)
  return value?.trim() || null
}

export async function seedLocazRentalTemplate(vendorReference) {
  ensureDatabaseEnv()

  if (!vendorReference) {
    throw new Error("Pass the vendor with --vendor <vendorProfileId | owner email>.")
  }

  const template = JSON.parse(readFileSync(templateUrl, "utf8"))
  const prisma = new PrismaClient()

  try {
    const vendor = vendorReference.includes("@")
      ? await prisma.vendorProfile.findFirst({ where: { user: { email: vendorReference.toLowerCase() } } })
      : await prisma.vendorProfile.findUnique({ where: { id: vendorReference } })

    if (!vendor) {
      throw new Error(`No vendor profile found for "${vendorReference}".`)
    }

    const existing = await prisma.contractTemplate.findFirst({
      where: { vendorId: vendor.id, name: template.name },
      orderBy: { createdAt: "asc" },
    })

    if (existing) {
      console.log(`✓ ${vendor.businessName ?? vendor.id} already has "${template.name}" (${existing.id}) - unchanged.`)
      return existing
    }

    const created = await prisma.contractTemplate.create({
      data: {
        vendorId: vendor.id,
        name: template.name,
        description: template.description,
        content: template.content,
      },
    })

    console.log(`✓ Seeded "${template.name}" (${created.id}) for ${vendor.businessName ?? vendor.id}. Legal review pending.`)
    return created
  } finally {
    await prisma.$disconnect()
  }
}

if (isDirectRun(import.meta.url)) {
  try {
    await seedLocazRentalTemplate(readVendorArgument(process.argv.slice(2)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
