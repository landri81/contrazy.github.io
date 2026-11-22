import { beforeEach, describe, expect, it, vi } from "vitest"

/** Security review, 22 Nov 2026: the super admin's e-mail can never be registered as an account. */

const findUser = vi.fn()
const createUser = vi.fn()

vi.mock("@/lib/env", () => ({ env: { SUPER_ADMIN_EMAIL: "admin@contrazy.test" } }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a), create: (...a: unknown[]) => createUser(...a) } } }))
vi.mock("@/features/auth/server/password", () => ({ hashPassword: async () => "hash" }))
vi.mock("@/lib/integrations/resend", () => ({ sendVendorWelcomeEmail: async () => undefined, sendAdminNewVendorSignupEmail: async () => undefined }))

const { POST } = await import("./route")
const { resetAuthRateLimits } = await import("@/lib/security/auth-rate-limit")

const register = (email: string, ip = "203.0.113.30") =>
  POST(new Request("https://contrazy.test/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ name: "Test Person", email, password: "A-long-Passw0rd!", confirmPassword: "A-long-Passw0rd!", businessName: "Test Rentals" }) }))

beforeEach(() => {
  resetAuthRateLimits()
  findUser.mockReset()
  createUser.mockReset()
})

describe("register", () => {
  it("answers as for a taken address for the super admin's e-mail, whatever its case, and creates nothing", async () => {
    findUser.mockResolvedValue(null)
    const response = await register("Admin@Contrazy.test")
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "EMAIL_EXISTS" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("refuses a sixth registration from one address within the hour", async () => {
    findUser.mockResolvedValue({ id: "taken" })
    for (let i = 0; i < 5; i += 1) expect((await register(`user${i}@rentals.test`)).status).toBe(409)
    const response = await register("user6@rentals.test")
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" })
    expect((await register("user7@rentals.test", "203.0.113.31")).status).toBe(409)
  })
})
