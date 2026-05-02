/**
 * Ensures the super admin user in the database has the SUPER_ADMIN role.
 * Runs as part of the Vercel build (after migrations) so every deployment
 * stays in sync with the SUPER_ADMIN_EMAIL env variable.
 */
import { PrismaClient } from "@prisma/client"

import { ensureDatabaseEnv, isDirectRun } from "./process-utils.mjs"

export async function ensureSuperAdmin() {
  ensureDatabaseEnv()

  const prisma = new PrismaClient()
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()

  if (!email) {
    console.warn("⚠  SUPER_ADMIN_EMAIL is not set — skipping super admin sync.")
    await prisma.$disconnect()
    return
  }

  const updated = await prisma.user.updateMany({
    where: { email, NOT: { role: "SUPER_ADMIN" } },
    data: { role: "SUPER_ADMIN" },
  })

  if (updated.count > 0) {
    console.log(`✓ Promoted ${email} to SUPER_ADMIN in the database.`)
  } else {
    console.log(`✓ ${email} already has the correct role — no changes needed.`)
  }

  await prisma.$disconnect()
}

if (isDirectRun(import.meta.url)) {
  try {
    await ensureSuperAdmin()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
