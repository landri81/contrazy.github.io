import { beforeEach, describe, expect, it, vi } from "vitest"

/** Super admin platform connection (LOCAZ): key and webhook created, handed over, all undone when the platform refuses. */

const findVendor = vi.fn()
const updateVendor = vi.fn()
const findConnection = vi.fn()
const createConnection = vi.fn()
const updateConnection = vi.fn()
const findKey = vi.fn()
const findEndpoint = vi.fn()
const auditCreate = vi.fn()
const createKey = vi.fn()
const revokeKey = vi.fn()
const createEndpoint = vi.fn()
const deleteEndpoint = vi.fn()
const fetchMock = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { STRIPE_SECRET_KEY: "sk_test_x", JWT_ENCRYPTION_SECRET: "j".repeat(32), NEXT_PUBLIC_APP_URL: "https://www.contrazy.com" } }))
vi.mock("@/lib/db/prisma", () => {
  const tx = {
    partnerPlatformConnection: { create: (...a: unknown[]) => createConnection(...a), update: (...a: unknown[]) => updateConnection(...a) },
    auditLog: { create: (...a: unknown[]) => auditCreate(...a) },
  }
  return {
    prisma: {
      vendorProfile: { findUnique: (...a: unknown[]) => findVendor(...a), update: (...a: unknown[]) => updateVendor(...a) },
      partnerPlatformConnection: { findFirst: (...a: unknown[]) => findConnection(...a) },
      partnerApiKey: { findUnique: (...a: unknown[]) => findKey(...a) },
      partnerWebhookEndpoint: { findUnique: (...a: unknown[]) => findEndpoint(...a) },
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})
vi.mock("@/features/partner-api/server/api-keys", () => ({
  createPartnerApiKey: (...a: unknown[]) => createKey(...a),
  revokePartnerApiKey: (...a: unknown[]) => revokeKey(...a),
  resolvePartnerApiKeyMode: () => "TEST",
}))
vi.mock("@/features/partner-webhooks/server/endpoints", () => ({
  createPartnerWebhookEndpoint: (...a: unknown[]) => createEndpoint(...a),
  deletePartnerWebhookEndpoint: (...a: unknown[]) => deleteEndpoint(...a),
}))
vi.mock("@/lib/partner-webhooks/secrets", () => ({ decryptPartnerWebhookSecret: () => "whsec_test_secret" }))

const { connectPlatform, disconnectPlatform, PlatformConnectionError } = await import("./platform-connections")

const actor = { id: "admin_1", email: "admin@contrazy.com" }
const vendor = {
  id: "vendor_locaz",
  businessName: "LOCAZ",
  reviewStatus: "APPROVED",
  stripeConnectionStatus: "CONNECTED",
  partnerAllowedOrigins: [],
  subscription: { status: "ACTIVE", currentPeriodEnd: null, planKey: "ENTERPRISE" },
}

beforeEach(() => {
  for (const mock of [findVendor, updateVendor, findConnection, createConnection, updateConnection, findKey, findEndpoint, auditCreate, createKey, revokeKey, createEndpoint, deleteEndpoint, fetchMock]) mock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  findVendor.mockResolvedValue({ ...vendor })
  findConnection.mockResolvedValue(null)
  createKey.mockResolvedValue({ apiKey: { id: "key_1", prefix: "cz_test_abcd1234" }, secret: "cz_test_" + "a".repeat(32) })
  createEndpoint.mockResolvedValue({ id: "we_1", secret: "whsec_new" })
  createConnection.mockResolvedValue({ id: "conn_1", connectedAt: new Date() })
  revokeKey.mockResolvedValue(null)
  deleteEndpoint.mockResolvedValue({ id: "we_1", deleted: true })
})

describe("connectPlatform", () => {
  it("issues a marked key, registers the webhook, allows the origin and hands both secrets to LOCAZ", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ connected: true }), { status: 200 }))
    await connectPlatform("vendor_locaz", "locaz", actor)

    expect(createKey.mock.calls[0][0]).toMatchObject({ vendorId: "vendor_locaz", platformPartner: "locaz", data: { scopes: ["bookings:read", "bookings:write", "charges:write", "webhooks:write"] } })
    expect(createEndpoint.mock.calls[0][1]).toMatchObject({ url: "https://www.locaz.co/api/integrations/contrazy/events" })
    // locaz.co redirects to www.locaz.co and LOCAZ may build its return URLs on either: both allowed.
    expect(updateVendor.mock.calls[0][0].data).toEqual({ partnerAllowedOrigins: { push: ["https://www.locaz.co", "https://locaz.co"] } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://www.locaz.co/api/integrations/contrazy/provision")
    expect(JSON.parse(init.body)).toMatchObject({ action: "connect", apiUrl: "https://www.contrazy.com", apiKey: expect.stringMatching(/^cz_test_/), webhookSecret: "whsec_new", vendorId: "vendor_locaz", vendorName: "LOCAZ" })
    expect(createConnection.mock.calls[0][0].data).toMatchObject({ vendorId: "vendor_locaz", platform: "locaz", apiKeyId: "key_1", webhookEndpointId: "we_1" })
    expect(auditCreate.mock.calls[0][0].data.action).toBe("partner_platform.connected")
    expect(JSON.stringify(auditCreate.mock.calls[0][0].data)).not.toContain("whsec_new")
  })

  it("works for the super admin of the environment variables, who has no user row: creator left empty", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ connected: true }), { status: 200 }))
    await connectPlatform("vendor_locaz", "locaz", { id: null, email: "admin@contrazy.com" })

    expect(createKey.mock.calls[0][0].userId).toBeNull()
    expect(createConnection.mock.calls[0][0].data.connectedById).toBeNull()
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({ actorId: null, actorType: "SUPER_ADMIN" })
  })

  it("undoes the key and the webhook when LOCAZ refuses or cannot be reached", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "key not marked for LOCAZ" }), { status: 403 }))
    await expect(connectPlatform("vendor_locaz", "locaz", actor)).rejects.toMatchObject({ code: "platform_refused" })
    expect(revokeKey).toHaveBeenCalledWith({ vendorId: "vendor_locaz", userId: "admin_1", keyId: "key_1" })
    expect(deleteEndpoint).toHaveBeenCalled()
    expect(createConnection).not.toHaveBeenCalled()

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(connectPlatform("vendor_locaz", "locaz", actor)).rejects.toMatchObject({ code: "platform_unreachable" })
  })

  it("refuses a vendor that is not ready: not approved, no Stripe, no active plan", async () => {
    for (const [patch, code] of [[{ reviewStatus: "PENDING" }, "vendor_not_approved"], [{ stripeConnectionStatus: "NOT_CONNECTED" }, "stripe_not_connected"], [{ subscription: { status: "CANCELED", currentPeriodEnd: null } }, "subscription_required"]] as const) {
      findVendor.mockResolvedValueOnce({ ...vendor, ...patch })
      await expect(connectPlatform("vendor_locaz", "locaz", actor)).rejects.toMatchObject({ code })
    }
    expect(createKey).not.toHaveBeenCalled()
  })
})

describe("disconnectPlatform", () => {
  it("tells LOCAZ with a request signed by the webhook secret, then revokes the key and removes the endpoint", async () => {
    findConnection.mockResolvedValue({ id: "conn_1", vendorId: "vendor_locaz", platform: "locaz", apiKeyId: "key_1", webhookEndpointId: "we_1", connectedAt: new Date() })
    findKey.mockResolvedValue({ prefix: "cz_test_abcd1234", mode: "TEST", revokedAt: null })
    findEndpoint.mockResolvedValue({ encryptedSecret: "enc" })
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))

    expect(await disconnectPlatform("vendor_locaz", "locaz", actor)).toEqual({ notified: true })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({ action: "disconnect", vendorId: "vendor_locaz" })
    expect(init.headers["Contrazy-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(revokeKey).toHaveBeenCalled()
    expect(deleteEndpoint).toHaveBeenCalled()
    expect(updateConnection.mock.calls[0][0].data.disconnectedAt).toBeInstanceOf(Date)
  })

  it("refuses when nothing is connected", async () => {
    await expect(disconnectPlatform("vendor_locaz", "locaz", actor)).rejects.toBeInstanceOf(PlatformConnectionError)
  })
})
