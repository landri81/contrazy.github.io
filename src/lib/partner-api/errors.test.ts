import { NextResponse } from "next/server"
import { describe, expect, it, vi } from "vitest"

import {
  buildPartnerErrorBody,
  createPartnerRequestId,
  PARTNER_REQUEST_ID_HEADER,
  PartnerApiError,
  partnerErrorResponse,
  withPartnerApi,
} from "@/lib/partner-api/errors"

const noParams = { params: Promise.resolve({}) }

describe("partner error shape", () => {
  it("builds { error: { code, message } } and only adds details when given", () => {
    expect(buildPartnerErrorBody("invalid_api_key", "Nope")).toEqual({
      error: { code: "invalid_api_key", message: "Nope" },
    })
    expect(buildPartnerErrorBody("insufficient_scope", "Nope", { requiredScope: "bookings:read" })).toEqual({
      error: { code: "insufficient_scope", message: "Nope", details: { requiredScope: "bookings:read" } },
    })
  })

  it("maps codes to HTTP statuses", () => {
    expect(new PartnerApiError("invalid_api_key", "x").status).toBe(401)
    expect(new PartnerApiError("insufficient_scope", "x").status).toBe(403)
    expect(new PartnerApiError("rate_limited", "x").status).toBe(429)
    expect(new PartnerApiError("internal_error", "x").status).toBe(500)
    expect(new PartnerApiError("invalid_request", "x", { status: 422 }).status).toBe(422)
  })

  it("renders the response with request_id and extra headers", async () => {
    const response = partnerErrorResponse(
      new PartnerApiError("rate_limited", "Slow down", { headers: { "Retry-After": "12" } }),
      "req_test"
    )

    expect(response.status).toBe(429)
    expect(response.headers.get(PARTNER_REQUEST_ID_HEADER)).toBe("req_test")
    expect(response.headers.get("Retry-After")).toBe("12")
    expect(await response.json()).toEqual({ error: { code: "rate_limited", message: "Slow down" } })
  })

  it("creates unique request ids", () => {
    const first = createPartnerRequestId()
    expect(first).toMatch(/^req_[0-9a-f]{32}$/)
    expect(createPartnerRequestId()).not.toBe(first)
  })
})

describe("withPartnerApi", () => {
  it("adds request_id to successful responses", async () => {
    const handler = withPartnerApi(async (_request, { requestId }) => NextResponse.json({ requestId }))
    const response = await handler(new Request("http://localhost/api/partner/v1/x"), noParams)
    const body = (await response.json()) as { requestId: string }

    expect(response.status).toBe(200)
    expect(response.headers.get(PARTNER_REQUEST_ID_HEADER)).toBe(body.requestId)
  })

  it("turns PartnerApiError into the uniform shape", async () => {
    const handler = withPartnerApi(async () => {
      throw new PartnerApiError("not_found", "Booking not found", { details: { id: "bk_1" } })
    })
    const response = await handler(new Request("http://localhost/api/partner/v1/x"), noParams)

    expect(response.status).toBe(404)
    expect(response.headers.get(PARTNER_REQUEST_ID_HEADER)).toMatch(/^req_/)
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Booking not found", details: { id: "bk_1" } },
    })
  })

  it("hides unexpected errors behind internal_error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const handler = withPartnerApi(async () => {
      throw new Error("database exploded")
    })
    const response = await handler(new Request("http://localhost/api/partner/v1/x"), noParams)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: { code: "internal_error", message: "An unexpected error occurred." } })
    expect(JSON.stringify(body)).not.toContain("database exploded")
    expect(consoleError).toHaveBeenCalled()
  })
})
