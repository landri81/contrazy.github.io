import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns"
import http from "node:http"
import https from "node:https"
import type { LookupFunction } from "node:net"
import { Readable } from "node:stream"

import { isLocalHostname, isPrivateAddressLiteral } from "@/lib/partner-webhooks/endpoint-url"

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

/**
 * DNS lookup that refuses hostnames resolving to loopback, private, link-local,
 * CGNAT or multicast addresses. It runs inside the connection itself, so the
 * address checked is the address connected to (no DNS-rebinding window).
 * Local hostnames resolve normally when `allowLocalhost` (development, tests).
 */
export function createPublicOnlyLookup(options: { allowLocalhost: boolean }): LookupFunction {
  return ((hostname: string, lookupOptions: LookupOptions, callback: LookupCallback) => {
    dnsLookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
      if (error) {
        callback(error, [])
        return
      }

      const local = options.allowLocalhost && isLocalHostname(hostname.toLowerCase())
      const list = addresses as LookupAddress[]

      if (!local && (list.length === 0 || list.some((entry) => isPrivateAddressLiteral(entry.address)))) {
        callback(Object.assign(new Error(`${hostname} does not resolve to a public address.`), { code: "EPRIVATEADDRESS" }), [])
        return
      }

      if (lookupOptions.all) {
        callback(null, list)
      } else {
        callback(null, list[0].address, list[0].family)
      }
    })
  }) as LookupFunction
}

/**
 * The subset of `fetch` the webhook transport uses (POST, headers, string body,
 * abort signal, no redirects), over `node:http(s)` with the public-only lookup.
 */
export function createSafeWebhookFetch(options: { allowLocalhost: boolean }): typeof fetch {
  const lookup = createPublicOnlyLookup(options)

  return ((input: string | URL, init: RequestInit = {}) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(String(input))
      const transport = url.protocol === "https:" ? https : http
      const headers = Object.fromEntries(new Headers(init.headers).entries())
      const body = typeof init.body === "string" ? init.body : ""
      const request = transport.request(
        url,
        {
          method: init.method ?? "GET",
          headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
          // A fresh connection per delivery: a pooled socket would skip the lookup check.
          agent: false,
          lookup,
          signal: init.signal ?? undefined,
        },
        (response) => {
          const status = response.statusCode ?? 0
          // Response only accepts 200-599 with a body; anything else is reported as a failed attempt.
          if (status < 200 || status > 599) {
            response.resume()
            reject(new Error(`Unexpected HTTP status ${status}.`))
            return
          }

          const noBody = status === 204 || status === 205 || status === 304
          if (noBody) response.resume()
          resolve(new Response(noBody ? null : (Readable.toWeb(response) as ReadableStream<Uint8Array>), { status }))
        }
      )

      request.on("error", reject)
      request.end(body)
    })) as typeof fetch
}
