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
const { resetAuthRateLimits } = await import("@/lib/security/auth-rate-limit")

type JwtArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0]
const jwt = (args: Partial<JwtArgs>) => authOptions.callbacks!.jwt!({ token: {}, ...args } as JwtArgs)
const credentials = authOptions.providers.find((provider) => provider.id === "credentials") as unknown as {
  options: { authorize: (credentials: Record<string, string>) => Promise<{ id: string; role: string } | null> }
}
const authorize = (email: string, password: string) => credentials.options.authorize({ email, password })

beforeEach(() => {
  findUser.mockReset()
  resetAuthRateLimits()
})

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

describe("sign-in throttle", () => {
  it("after 10 attempts for one e-mail in 15 minutes, even the right password is refused", async () => {
    findUser.mockResolvedValue({ id: "user_1", name: "X", email: "owner@rentals.test", role: "VENDOR", passwordHash: "hash:right-password" })
    for (let i = 0; i < 10; i += 1) expect(await authorize("owner@rentals.test", `guess-${i}`)).toBeNull()
    expect(await authorize("owner@rentals.test", "right-password")).toBeNull()
    expect(await authorize("other@rentals.test", "right-password")).toMatchObject({ id: "user_1" })
  })
})

describe("role re-check", () => {
  const fresh = { sub: "user_1", role: "ADMIN" as const, roleCheckedAt: Date.now(), superAdminSignIn: false }
  const stale = { ...fresh, roleCheckedAt: Date.now() - 6 * 60_000 }

  it("reads the role again after 5 minutes: a demoted admin loses it, a deleted account gets no staff role", async () => {
    findUser.mockResolvedValue({ role: "VENDOR" })
    expect(await jwt({ token: { ...fresh } })).toMatchObject({ role: "ADMIN" })
    expect(findUser).not.toHaveBeenCalled()
    expect(await jwt({ token: { ...stale } })).toMatchObject({ role: "VENDOR" })
    expect(findUser.mock.calls[0][0]).toMatchObject({ where: { id: "user_1" } })
    findUser.mockResolvedValue(null)
    expect(await jwt({ token: { ...stale } })).toMatchObject({ role: "VENDOR" })
    // A session from before this change (no check time) is read again at once.
    findUser.mockResolvedValue({ role: "ADMIN" })
    expect(await jwt({ token: { sub: "user_1", role: "ADMIN" } })).toMatchObject({ role: "ADMIN", roleCheckedAt: expect.any(Number) })
  })

  it("never reads a user row for the super admin's own sign-in", async () => {
    const user = await authorize("admin@contrazy.test", "env-password-for-tests")
    const token = await jwt({ user: user as never, account: { provider: "credentials" } as never })
    expect(token).toMatchObject({ role: "SUPER_ADMIN", superAdminSignIn: true })
    expect(await jwt({ token: { ...token, roleCheckedAt: 0 } })).toMatchObject({ role: "SUPER_ADMIN" })
    // Sessions opened before this change: the env sign-in's id, or Google with the super admin's address.
    expect(await jwt({ token: { sub: "super-admin-env-user", email: "admin@contrazy.test", role: "SUPER_ADMIN" } })).toMatchObject({ role: "SUPER_ADMIN" })
    expect(await jwt({ token: { sub: "user_google", email: "Admin@contrazy.test", role: "SUPER_ADMIN" } })).toMatchObject({ role: "SUPER_ADMIN" })
    expect(findUser).not.toHaveBeenCalled()
  })
})
