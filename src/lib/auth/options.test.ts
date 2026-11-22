import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Security review, 22 Nov 2026: the super admin role comes only from the super admin's own sign-in (the environment
 * credentials) or Google proving the address, never from an account registered with that e-mail and its own password.
 */

const findUser = vi.fn()

vi.mock("@/lib/env", () => ({
  env: {
    SUPER_ADMIN_EMAIL: "admin@contrazy.test",
    SUPER_ADMIN_PASSWORD: "env-password-for-tests",
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
  },
}))
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) } } }))
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }))
vi.mock("@/features/auth/server/password", () => ({ verifyPassword: async (given: string, hash: string) => hash === `hash:${given}` }))

const { authOptions } = await import("./options")

type JwtArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0]
const jwt = (args: Partial<JwtArgs>) => authOptions.callbacks!.jwt!({ token: {}, ...args } as JwtArgs)
const credentials = authOptions.providers.find((provider) => provider.id === "credentials") as unknown as {
  options: { authorize: (credentials: Record<string, string>) => Promise<{ id: string; role: string } | null> }
}
const authorize = (email: string, password: string) => credentials.options.authorize({ email, password })

beforeEach(() => findUser.mockReset())

describe("super admin role", () => {
  it("is given to the environment super admin's own sign-in", async () => {
    const user = await authorize("Admin@Contrazy.test", "env-password-for-tests")
    expect(user).toMatchObject({ id: "super-admin-env-user", role: "SUPER_ADMIN" })
    expect(await jwt({ user: user as never, account: { provider: "credentials" } as never })).toMatchObject({ role: "SUPER_ADMIN" })
  })

  it("is not given to an account registered with the super admin's e-mail and its own password", async () => {
    findUser.mockResolvedValue({ id: "user_intruder", name: "X", email: "admin@contrazy.test", role: "VENDOR", passwordHash: "hash:their-own-password" })
    const user = await authorize("admin@contrazy.test", "their-own-password")
    expect(user).toMatchObject({ id: "user_intruder", role: "VENDOR" })
    expect(await jwt({ user: user as never, account: { provider: "credentials" } as never })).toMatchObject({ role: "VENDOR" })
  })

  it("is given to a Google sign-in with the super admin's address (Google proves it), not to another address", async () => {
    expect(await jwt({ user: { id: "u_1", email: "admin@contrazy.test" } as never, account: { provider: "google" } as never })).toMatchObject({ role: "SUPER_ADMIN" })
    expect(await jwt({ user: { id: "u_2", email: "someone@contrazy.test", role: "VENDOR" } as never, account: { provider: "google" } as never })).toMatchObject({ role: "VENDOR" })
  })

  it("refuses a wrong environment password", async () => {
    findUser.mockResolvedValue(null)
    expect(await authorize("admin@contrazy.test", "env-password-for-tests-not")).toBeNull()
  })
})
