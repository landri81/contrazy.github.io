import { checkDatabaseGuard } from "./database-guard.mjs"
import { ensureSuperAdmin } from "./ensure-super-admin.mjs"
import { runPrismaCommand, runPrismaMigrateDeployWithRetry } from "./run-prisma-command.mjs"
import { runNpx } from "./process-utils.mjs"
import { wakeDatabase } from "./wake-db.mjs"

try {
  // Before anything touches the database: a staging build must never migrate live's database, nor the reverse.
  console.log(checkDatabaseGuard())
  await runPrismaCommand(["generate"])
  await wakeDatabase()
  await runPrismaMigrateDeployWithRetry()
  await ensureSuperAdmin()
  await runNpx(["next", "build"])
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
