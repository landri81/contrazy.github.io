/**
 * Pings the database with retries to handle Neon's auto-suspend cold start.
 * Neon free-tier branches can take 1–10 s to resume; this gives them 5 chances
 * before aborting the build.
 */
import { PrismaClient } from "@prisma/client"

import { ensureDatabaseEnv, isDirectRun } from "./process-utils.mjs"

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5_000

export async function wakeDatabase({
  maxRetries = MAX_RETRIES,
  retryDelayMs = RETRY_DELAY_MS,
} = {}) {
  ensureDatabaseEnv()

  async function wake(attempt = 1) {
    const prisma = new PrismaClient()

    try {
      await prisma.$queryRaw`SELECT 1`
      await prisma.$disconnect()
      console.log(`✓ Database ready (attempt ${attempt}/${maxRetries})`)
    } catch (error) {
      await prisma.$disconnect().catch(() => {})

      if (attempt >= maxRetries) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Database unreachable after ${maxRetries} attempts: ${message}`)
      }

      console.log(
        `⏳ Database waking up... retrying in ${retryDelayMs / 1000}s (attempt ${attempt}/${maxRetries})`
      )
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      return wake(attempt + 1)
    }
  }

  await wake()
}

if (isDirectRun(import.meta.url)) {
  try {
    await wakeDatabase()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${message}`)
    process.exit(1)
  }
}
