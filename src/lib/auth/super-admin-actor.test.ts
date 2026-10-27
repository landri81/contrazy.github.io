import { beforeEach, describe, expect, it, vi } from "vitest"

/** The super admin as an audit actor: a user row id or null, never the session id of the environment super admin. */

const getAuthSession = vi.fn()
const findUser = vi.fn()

vi.mock("@/lib/auth/session", () => ({ getAuthSession: () => getAuthSession() }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) } } }))

const { getSuperAdminActor } = await import("./super-admin-actor")

beforeEach(() => {
  getAuthSession.mockReset()
  findUser.mockReset()
})

describe("getSuperAdminActor", () => {
  it("leaves the id empty for the super admin of the environment variables when no user row has that e-mail", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "super-admin-env-user", email: "Admin@Contrazy.com", role: "SUPER_ADMIN" } })
    findUser.mockResolvedValue(null)
    expect(await getSuperAdminActor()).toEqual({ id: null, email: "admin@contrazy.com" })
    expect(findUser.mock.calls[0][0].where).toEqual({ email: "admin@contrazy.com" })
  })

  it("uses the user row with the same e-mail", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "super-admin-env-user", email: "admin@contrazy.com", role: "SUPER_ADMIN" } })
    findUser.mockResolvedValue({ id: "user_admin" })
    expect(await getSuperAdminActor()).toEqual({ id: "user_admin", email: "admin@contrazy.com" })
  })

  it("refuses anyone who is not a super admin", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "user_1", email: "vendor@example.com", role: "VENDOR" } })
    expect(await getSuperAdminActor()).toBeNull()
    getAuthSession.mockResolvedValue(null)
    expect(await getSuperAdminActor()).toBeNull()
    expect(findUser).not.toHaveBeenCalled()
  })
})
