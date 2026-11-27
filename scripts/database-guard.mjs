// Wrong-database guard for the build: scripts/vercel-build.mjs calls it before `prisma migrate deploy`.
// Same rule as src/lib/db/database-guard.ts: DATABASE_GUARD_FORBIDDEN_ENDPOINTS lists the Neon endpoints this
// deployment must never use (staging: production's; live: staging's and locaz-dev's). If DATABASE_URL or DIRECT_URL
// points at one, the build stops before any migration.

export function neonEndpointId(value) {
  let host = value.trim()
  try {
    host = new URL(host).hostname || host
  } catch {
    // Already a host name or an endpoint id.
  }
  return host.toLowerCase().split(".")[0].replace(/-pooler$/, "")
}

/** @param {Record<string, string | undefined>} [env] */
export function checkDatabaseGuard(env = process.env) {
  const blocked = new Set(
    (env.DATABASE_GUARD_FORBIDDEN_ENDPOINTS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(neonEndpointId),
  )
  if (blocked.size === 0) return "Database guard: not configured (DATABASE_GUARD_FORBIDDEN_ENDPOINTS empty)."
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = env[name]
    if (!url) continue
    const id = neonEndpointId(url)
    if (blocked.has(id)) {
      throw new Error(`Wrong database: ${name} points at the Neon endpoint ${id}, which this deployment must not use. Stopping the build.`)
    }
  }
  return `Database guard: ok (${blocked.size} forbidden endpoint${blocked.size === 1 ? "" : "s"} not used).`
}
