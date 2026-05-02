import { ensureSuperAdmin } from "./ensure-super-admin.mjs"
import { runPrismaMigrateDeployWithRetry } from "./run-prisma-command.mjs"
import { wakeDatabase } from "./wake-db.mjs"

try {
  await wakeDatabase()
  await runPrismaMigrateDeployWithRetry()
  await ensureSuperAdmin()
  console.log("✓ Database setup complete.")
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
