/**
 * Pings the database with retries to handle Neon's auto-suspend cold start.
 * Neon free-tier branches can take 1–10 s to resume; this gives them 5 chances
 * before aborting the build.
 */
import { PrismaClient } from "@prisma/client"

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5_000

async function wake(attempt = 1) {
  const prisma = new PrismaClient()
  try {
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()
    console.log(`✓ Database ready (attempt ${attempt}/${MAX_RETRIES})`)
  } catch (err) {
    await prisma.$disconnect().catch(() => {})
    if (attempt >= MAX_RETRIES) {
      console.error(`✗ Database unreachable after ${MAX_RETRIES} attempts: ${err.message}`)
      process.exit(1)
    }
    console.log(`⏳ Database waking up... retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})`)
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    return wake(attempt + 1)
  }
}

await wake()
