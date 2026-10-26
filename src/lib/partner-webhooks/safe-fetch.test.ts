import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const answers = new Map<string, { address: string; family: number }[]>()

vi.mock("node:dns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns")>()
  return {
    ...actual,
    lookup: (hostname: string, options: object, callback: (error: Error | null, addresses: unknown) => void) => {
      const fake = answers.get(hostname)
      if (fake) {
        callback(null, fake)
        return
      }
      actual.lookup(hostname, options, callback as never)
    },
  }
})

const { createPublicOnlyLookup, createSafeWebhookFetch } = await import("./safe-fetch")
const { postSignedWebhook } = await import("./transport")

function resolve(hostname: string, allowLocalhost: boolean, all = false) {
  return new Promise<{ error: NodeJS.ErrnoException | null; address: unknown }>((done) => {
    const lookup = createPublicOnlyLookup({ allowLocalhost }) as unknown as (
      hostname: string,
      options: { all?: boolean },
      callback: (error: NodeJS.ErrnoException | null, address: unknown) => void
    ) => void
    lookup(hostname, { all }, (error, address) => done({ error, address }))
  })
}

describe("createPublicOnlyLookup", () => {
  it("passes hosts that resolve to public addresses", async () => {
    answers.set("hooks.partner.test", [{ address: "93.184.216.34", family: 4 }])
    expect(await resolve("hooks.partner.test", false)).toEqual({ error: null, address: "93.184.216.34" })
    expect((await resolve("hooks.partner.test", false, true)).address).toEqual([{ address: "93.184.216.34", family: 4 }])
  })

  it("refuses public names that resolve to private, loopback or metadata addresses (SSRF)", async () => {
    for (const address of ["127.0.0.1", "10.0.0.5", "192.168.1.10", "169.254.169.254", "100.64.0.1"]) {
      answers.set("rebind.partner.test", [{ address, family: 4 }])
      const { error } = await resolve("rebind.partner.test", false)
      expect(error?.code).toBe("EPRIVATEADDRESS")
    }
    answers.set("rebind6.partner.test", [{ address: "fd00::1", family: 6 }])
    expect((await resolve("rebind6.partner.test", false)).error?.code).toBe("EPRIVATEADDRESS")
  })

  it("refuses a host when any of its addresses is private", async () => {
    answers.set("mixed.partner.test", [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ])
    expect((await resolve("mixed.partner.test", false)).error?.code).toBe("EPRIVATEADDRESS")
  })

  it("lets localhost through only when local receivers are allowed", async () => {
    answers.set("localhost", [{ address: "127.0.0.1", family: 4 }])
    expect((await resolve("localhost", false)).error?.code).toBe("EPRIVATEADDRESS")
    expect(await resolve("localhost", true)).toEqual({ error: null, address: "127.0.0.1" })
    // A public-looking name never gets the local exemption.
    answers.set("evil.partner.test", [{ address: "127.0.0.1", family: 4 }])
    expect((await resolve("evil.partner.test", true)).error?.code).toBe("EPRIVATEADDRESS")
  })
})

describe("createSafeWebhookFetch", () => {
  let server: Server
  let port: number
  let received: { method?: string; body: string; signature?: string | string[] }

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = ""
      request.on("data", (chunk) => (body += chunk))
      request.on("end", () => {
        received = { method: request.method, body, signature: request.headers["contrazy-signature"] }
        response.writeHead(request.url === "/fail" ? 500 : 200, { "content-type": "text/plain" })
        response.end(request.url === "/fail" ? "nope" : "ok")
      })
    })
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
    port = (server.address() as AddressInfo).port
    answers.set("localhost", [{ address: "127.0.0.1", family: 4 }])
  })

  afterAll(() => new Promise<void>((done) => server.close(() => done())))

  it("sends the signed POST and reads status and body", async () => {
    const result = await postSignedWebhook({ url: `http://localhost:${port}/hook`, secret: "whsec_test", rawBody: '{"a":1}', eventId: "evt_1", eventType: "ping", attempt: 1, allowLocalhost: true })
    expect(result).toMatchObject({ ok: true, status: 200, bodySnippet: "ok", error: null })
    expect(received).toMatchObject({ method: "POST", body: '{"a":1}' })
    expect(received.signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
  })

  it("reports a non-2xx answer as a failed attempt", async () => {
    const result = await postSignedWebhook({ url: `http://localhost:${port}/fail`, secret: "whsec_test", rawBody: "{}", eventId: "evt_2", eventType: "ping", attempt: 1, allowLocalhost: true })
    expect(result).toMatchObject({ ok: false, status: 500, bodySnippet: "nope" })
  })

  it("never connects to a local receiver when local receivers are not allowed", async () => {
    const result = await postSignedWebhook({ url: `http://localhost:${port}/hook`, secret: "whsec_test", rawBody: "{}", eventId: "evt_3", eventType: "ping", attempt: 1, allowLocalhost: false })
    expect(result.ok).toBe(false)
    expect(result.status).toBeNull()
    expect(result.error).toBe("localhost does not resolve to a public address.")
  })

  it("is a fetch-compatible function", async () => {
    const response = await createSafeWebhookFetch({ allowLocalhost: true })(`http://localhost:${port}/hook`, { method: "POST", body: "x" })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("ok")
  })
})
