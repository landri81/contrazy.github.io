/**
 * Wrong-database guard (LOCAZ docs/launch-checklist.md, stage A step 4). A deployment lists the Neon endpoints it must never
 * use in DATABASE_GUARD_FORBIDDEN_ENDPOINTS (comma-separated endpoint ids such as `ep-cool-name-a1b2c3d4`, or host
 * names): staging lists production's endpoint and live lists staging's and the E2E branch's. A copied or mistyped
 * DATABASE_URL then stops the app instead of mixing test data with real bookings. scripts/database-guard.mjs
 * runs the same check before `prisma migrate deploy` in `vercel-build`, so a wrong deployment never migrates either.
 * Without the setting, nothing is checked (localhost and E2E).
 */

/** The Neon endpoint id of a connection string, host name or id: pooled and direct hosts give the same id. */
export function neonEndpointId(value: string): string {
  let host = value.trim()
  try {
    host = new URL(host).hostname || host
  } catch {
    // Already a host name or an endpoint id.
  }
  return host.toLowerCase().split(".")[0].replace(/-pooler$/, "")
}

/** The first forbidden endpoint one of the URLs points at, or null when none does (or nothing is forbidden). */
export function forbiddenDatabaseUse(urls: Array<string | undefined>, forbidden: string | undefined): string | null {
  const blocked = new Set(
    (forbidden ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(neonEndpointId),
  )
  if (blocked.size === 0) return null
  for (const url of urls) {
    if (!url) continue
    const id = neonEndpointId(url)
    if (blocked.has(id)) return id
  }
  return null
}

export function assertAllowedDatabase(env: Record<string, string | undefined> = process.env) {
  const hit = forbiddenDatabaseUse([env.DATABASE_URL, env.DIRECT_URL], env.DATABASE_GUARD_FORBIDDEN_ENDPOINTS)
  if (hit) {
    throw new Error(
      `Wrong database: this deployment must not use the Neon endpoint ${hit} (DATABASE_GUARD_FORBIDDEN_ENDPOINTS). Refusing to start.`,
    )
  }
}
