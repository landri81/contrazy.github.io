import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const PARTNER_REQUEST_ID_HEADER = "request_id"

export type PartnerApiErrorCode =
  | "invalid_api_key"
  | "insufficient_scope"
  | "rate_limited"
  | "invalid_request"
  | "not_found"
  | "internal_error"
  | "idempotency_key_required"
  | "idempotency_key_conflict"
  | "idempotency_key_in_use"
  | "external_ref_conflict"
  | "return_url_not_allowed"
  | "booking_locked"
  | "booking_not_cancellable"
  | "subscription_required"
  | "plan_limit_reached"
  | "plan_feature_unavailable"
  | "vendor_not_approved"
  | "stripe_not_connected"
  | "contract_template_not_found"
  | "contract_template_required"
  | "step_requires_configuration"
  | "launch_rejected"
  | "webhook_url_not_allowed"
  | "webhook_endpoint_limit_reached"

export type PartnerApiErrorBody = {
  error: {
    code: PartnerApiErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

const DEFAULT_STATUS: Record<PartnerApiErrorCode, number> = {
  invalid_api_key: 401,
  insufficient_scope: 403,
  rate_limited: 429,
  invalid_request: 400,
  not_found: 404,
  internal_error: 500,
  idempotency_key_required: 400,
  idempotency_key_conflict: 409,
  idempotency_key_in_use: 409,
  external_ref_conflict: 409,
  return_url_not_allowed: 422,
  booking_locked: 409,
  booking_not_cancellable: 409,
  subscription_required: 402,
  plan_limit_reached: 402,
  plan_feature_unavailable: 403,
  vendor_not_approved: 403,
  stripe_not_connected: 422,
  contract_template_not_found: 422,
  contract_template_required: 422,
  step_requires_configuration: 422,
  launch_rejected: 422,
  webhook_url_not_allowed: 422,
  webhook_endpoint_limit_reached: 409,
}

export class PartnerApiError extends Error {
  readonly code: PartnerApiErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>
  readonly headers?: Record<string, string>

  constructor(
    code: PartnerApiErrorCode,
    message: string,
    options: { status?: number; details?: Record<string, unknown>; headers?: Record<string, string> } = {}
  ) {
    super(message)
    this.name = "PartnerApiError"
    this.code = code
    this.status = options.status ?? DEFAULT_STATUS[code]
    this.details = options.details
    this.headers = options.headers
  }
}

export function createPartnerRequestId() {
  return `req_${randomUUID().replaceAll("-", "")}`
}

export function buildPartnerErrorBody(
  code: PartnerApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): PartnerApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }
}

export function partnerErrorResponse(error: PartnerApiError, requestId: string) {
  const response = NextResponse.json(buildPartnerErrorBody(error.code, error.message, error.details), {
    status: error.status,
  })

  for (const [name, value] of Object.entries(error.headers ?? {})) {
    response.headers.set(name, value)
  }

  response.headers.set(PARTNER_REQUEST_ID_HEADER, requestId)
  return response
}

export type PartnerRouteContext<TParams = Record<string, string>> = {
  params: Promise<TParams>
  requestId: string
}

/**
 * Wraps a `/api/partner/v1/*` handler: assigns a request id, sets the
 * `request_id` header on every response and turns thrown errors into the
 * uniform `{ error: { code, message, details? } }` shape.
 */
export function withPartnerApi<TParams = Record<string, string>>(
  handler: (request: Request, context: PartnerRouteContext<TParams>) => Promise<Response>
) {
  return async function partnerRouteHandler(
    request: Request,
    routeContext: { params: Promise<TParams> }
  ): Promise<Response> {
    const requestId = createPartnerRequestId()

    try {
      const response = await handler(request, { params: routeContext?.params, requestId })
      response.headers.set(PARTNER_REQUEST_ID_HEADER, requestId)
      return response
    } catch (error) {
      if (error instanceof PartnerApiError) {
        return partnerErrorResponse(error, requestId)
      }

      console.error("Partner API request failed", {
        requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      return partnerErrorResponse(
        new PartnerApiError("internal_error", "An unexpected error occurred."),
        requestId
      )
    }
  }
}
