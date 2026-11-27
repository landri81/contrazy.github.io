import { describe, expect, it } from "vitest"

import { checkDatabaseGuard } from "../../../scripts/database-guard.mjs"
import { assertAllowedDatabase, forbiddenDatabaseUse, neonEndpointId } from "./database-guard"

const pooled = "postgresql://user:secret@ep-quiet-lake-a1b2c3d4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const direct = "postgresql://user:secret@ep-quiet-lake-a1b2c3d4.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"
const other = "postgresql://user:secret@ep-bright-sun-e5f6a7b8-pooler.c-2.eu-central-1.aws.neon.tech/neondb"

describe("neonEndpointId", () => {
  it("gives the same id for pooled and direct URLs, host names and bare ids", () => {
    expect(neonEndpointId(pooled)).toBe("ep-quiet-lake-a1b2c3d4")
    expect(neonEndpointId(direct)).toBe("ep-quiet-lake-a1b2c3d4")
    expect(neonEndpointId(" EP-Quiet-Lake-A1B2C3D4 ")).toBe("ep-quiet-lake-a1b2c3d4")
  })
})

describe("forbiddenDatabaseUse", () => {
  it("does nothing when no endpoint is forbidden", () => {
    expect(forbiddenDatabaseUse([pooled, direct], undefined)).toBeNull()
  })

  it("names the forbidden endpoint the database or direct URL points at", () => {
    expect(forbiddenDatabaseUse([other, direct], "ep-nothing-x, ep-quiet-lake-a1b2c3d4")).toBe("ep-quiet-lake-a1b2c3d4")
  })

  it("lets an allowed endpoint through", () => {
    expect(forbiddenDatabaseUse([other], "ep-quiet-lake-a1b2c3d4")).toBeNull()
  })
})

describe("assertAllowedDatabase", () => {
  it("refuses to start on a forbidden endpoint, without printing the connection string", () => {
    const run = () => assertAllowedDatabase({ DATABASE_URL: pooled, DATABASE_GUARD_FORBIDDEN_ENDPOINTS: "ep-quiet-lake-a1b2c3d4" })
    expect(run).toThrow(/Wrong database: .*ep-quiet-lake-a1b2c3d4/)
    expect(run).not.toThrow(/secret/)
  })

  it("starts normally otherwise", () => {
    expect(() => assertAllowedDatabase({ DATABASE_URL: other, DATABASE_GUARD_FORBIDDEN_ENDPOINTS: "ep-quiet-lake-a1b2c3d4" })).not.toThrow()
    expect(() => assertAllowedDatabase({ DATABASE_URL: pooled })).not.toThrow()
  })
})

describe("scripts/database-guard.mjs (vercel-build, before prisma migrate deploy)", () => {
  it("stops the build on a forbidden endpoint", () => {
    expect(() => checkDatabaseGuard({ DATABASE_URL: other, DIRECT_URL: direct, DATABASE_GUARD_FORBIDDEN_ENDPOINTS: "ep-quiet-lake-a1b2c3d4" })).toThrow(
      /Wrong database: DIRECT_URL/,
    )
  })

  it("passes on an allowed endpoint and when not configured", () => {
    expect(checkDatabaseGuard({ DATABASE_URL: other, DATABASE_GUARD_FORBIDDEN_ENDPOINTS: "ep-quiet-lake-a1b2c3d4" })).toMatch(/ok/)
    expect(checkDatabaseGuard({ DATABASE_URL: pooled })).toMatch(/not configured/)
  })
})
