import { ensureDatabaseEnv, isDirectRun, runNpx } from "./process-utils.mjs"

export async function runPrismaCommand(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error("No Prisma command arguments provided.")
  }

  ensureDatabaseEnv()
  await runNpx(["prisma", ...args])
}

export async function runPrismaMigrateDeployWithRetry({
  maxRetries = 3,
  retryDelayMs = 5_000,
} = {}) {
  ensureDatabaseEnv()

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await runNpx(["prisma", "migrate", "deploy"])
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const output =
        error && typeof error === "object" && "output" in error && error.output
          ? String(error.output)
          : ""
      const retrySource = `${message}\n${output}`
      const retryable =
        retrySource.includes("P1002") || retrySource.toLowerCase().includes("advisory lock")

      if (!retryable || attempt >= maxRetries) {
        throw error
      }

      console.log(
        `⏳ Prisma migrate deploy hit an advisory lock. Retrying in ${retryDelayMs / 1000}s (attempt ${attempt}/${maxRetries})`
      )
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }
}

if (isDirectRun(import.meta.url)) {
  try {
    await runPrismaCommand(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
