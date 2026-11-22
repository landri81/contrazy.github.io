import { beforeEach, describe, expect, it, vi } from "vitest"

import { hashResetToken } from "@/features/auth/server/reset-token"
import { resetAuthRateLimits } from "@/lib/security/auth-rate-limit"

/** Security review, 22 Nov 2026: reset tokens stored hashed, and reset requests throttled per e-mail. */

const findUser = vi.fn()
const createToken = vi.fn()
const sendReset = vi.fn()

vi.mock("@/lib/env", () => ({ env: { NEXTAUTH_URL: "https://contrazy.test" } }))
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) }, passwordResetToken: { deleteMany: async () => ({ count: 0 }), create: (...a: unknown[]) => createToken(...a) } },
}))
vi.mock("@/lib/integrations/resend", () => ({ sendPasswordResetEmail: (...a: unknown[]) => sendReset(...a) }))

const { POST } = await import("./route")

const ask = (email: string) => POST(new Request("https://contrazy.test/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" }, body: JSON.stringify({ email }) }))

beforeEach(() => {
  resetAuthRateLimits()
  findUser.mockReset().mockResolvedValue({ id: "user_1", email: "owner@rentals.test" })
  createToken.mockReset().mockResolvedValue({})
  sendReset.mockReset().mockResolvedValue(undefined)
})

describe("forgot-password", () => {
  it("e-mails the token and stores only its hash", async () => {
    expect((await ask("owner@rentals.test")).status).toBe(200)
    const url = new URL(sendReset.mock.calls[0][1] as string)
    const token = url.searchParams.get("token")!
    expect(token.length).toBeGreaterThanOrEqual(43)
    const stored = createToken.mock.calls[0][0].data.token as string
    expect(stored).not.toBe(token)
    expect(stored).toBe(hashResetToken(token))
  })

  it("after 3 requests for one e-mail in an hour, answers the same and sends nothing", async () => {
    for (let i = 0; i < 3; i += 1) await ask("owner@rentals.test")
    const response = await ask("Owner@rentals.test")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true })
    expect(sendReset).toHaveBeenCalledTimes(3)
  })
})
