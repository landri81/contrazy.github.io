import { ensureSuperAdmin } from "./ensure-super-admin.mjs"
import { runPrismaCommand, runPrismaMigrateDeployWithRetry } from "./run-prisma-command.mjs"
import { wakeDatabase } from "./wake-db.mjs"

try {
  await wakeDatabase()
  await runPrismaMigrateDeployWithRetry()
  await ensureSuperAdmin()
  await runPrismaCommand(["studio"])
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
