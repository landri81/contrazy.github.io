/**
 * Clears all rows from every table while keeping the schema intact.
 * Uses TRUNCATE … CASCADE so FK order doesn't matter.
 * Safe to re-run — idempotent.
 */
import { PrismaClient } from "@prisma/client"
import { ensureDatabaseEnv, isDirectRun } from "./process-utils.mjs"
import { ensureSuperAdmin } from "./ensure-super-admin.mjs"

export async function clearDatabase() {
  ensureDatabaseEnv()
  const prisma = new PrismaClient()

  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "TransactionEvent",
        "DocumentAsset",
        "TransactionRequirement",
        "TransactionLink",
        "KycVerification",
        "SignatureRecord",
        "Payment",
        "DepositAuthorization",
        "Dispute",
        "WebhookEvent",
        "AuditLog",
        "Transaction",
        "ChecklistItem",
        "ChecklistTemplate",
        "ContractTemplate",
        "Invitation",
        "PasswordResetToken",
        "ClientProfile",
        "VendorProfile",
        "Account",
        "Session",
        "VerificationToken",
        "User"
      CASCADE
    `)
    console.log("✓ All tables cleared.")
  } finally {
    await prisma.$disconnect()
  }
}

if (isDirectRun(import.meta.url)) {
  try {
    await clearDatabase()
    await ensureSuperAdmin()
    console.log("✓ Fresh database ready.")
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
