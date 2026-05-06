import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function getNormalizedDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL

  if (!rawUrl) {
    return undefined
  }

  try {
    const url = new URL(rawUrl)

    // Neon pooled URLs can be flaky with channel binding enabled in local/dev
    // environments. Keep SSL, but drop that parameter and ensure a reasonable
    // connect timeout for dashboard/server rendering queries.
    if (url.hostname.includes("-pooler.")) {
      url.searchParams.delete("channel_binding")

      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "15")
      }
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

const normalizedDatabaseUrl = getNormalizedDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(normalizedDatabaseUrl
      ? {
          datasources: {
            db: {
              url: normalizedDatabaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
