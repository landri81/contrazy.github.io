import { isSuccessfulWebhookStatus, PARTNER_WEBHOOK_TIMEOUT_MS } from "@/lib/partner-webhooks/backoff"
import { PARTNER_WEBHOOK_API_VERSION } from "@/lib/partner-webhooks/catalogue"
import { createSafeWebhookFetch } from "@/lib/partner-webhooks/safe-fetch"
import { CONTRAZY_SIGNATURE_HEADER, signContrazyPayload } from "@/lib/partner-webhooks/signature"

export const RESPONSE_SNIPPET_MAX_BYTES = 1024
const ERROR_MAX_LENGTH = 500

export type WebhookSendResult = {
  ok: boolean
  status: number | null
  bodySnippet: string | null
  error: string | null
  durationMs: number
}

function cleanText(value: string, maxLength: number) {
  // Postgres text columns reject NUL; keep the snippet printable.
  return value.replace(/\u0000/g, "").slice(0, maxLength)
}

/** Reads at most `maxBytes` of a response body, then cancels the rest of the stream. */
export async function readResponseSnippet(response: Response, maxBytes = RESPONSE_SNIPPET_MAX_BYTES) {
  if (!response.body) {
    return null
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()

      if (done || !value) {
        break
      }

      chunks.push(value)
      received += value.byteLength
    }
  } catch {
    // A body that fails mid-stream still leaves us the status code.
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  if (received === 0) {
    return null
  }

  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).subarray(0, maxBytes)
  // `fatal: false` turns a multi-byte character cut at the limit into U+FFFD instead of throwing.
  return cleanText(new TextDecoder("utf-8", { fatal: false }).decode(bytes), maxBytes) || null
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Timed out waiting for the endpoint to respond."
    }

    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause
    const detail = cause?.code ?? cause?.message
    return cleanText(detail ? `${error.message} (${detail})` : error.message, ERROR_MAX_LENGTH)
  }

  return "Unknown delivery error."
}

/**
 * POSTs one signed event. The body is signed at send time, so every attempt
 * carries a fresh `t=`. Redirects are not followed and count as failures.
 * A host that resolves to a private address fails like an unreachable one.
 */
export async function postSignedWebhook(input: {
  url: string
  secret: string
  rawBody: string
  eventId: string
  eventType: string
  attempt: number
  /** Local receivers allowed (outside production). Only used by the default transport. */
  allowLocalhost?: boolean
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<WebhookSendResult> {
  const startedAt = Date.now()
  // The default transport refuses hosts that resolve to private addresses (SSRF), checked at connect time.
  const fetchImpl = input.fetchImpl ?? createSafeWebhookFetch({ allowLocalhost: input.allowLocalhost ?? false })

  try {
    const response = await fetchImpl(input.url, {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeoutMs ?? PARTNER_WEBHOOK_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": `Contrazy-Webhooks/${PARTNER_WEBHOOK_API_VERSION}`,
        [CONTRAZY_SIGNATURE_HEADER]: signContrazyPayload(input.rawBody, input.secret),
        "Contrazy-Event-Id": input.eventId,
        "Contrazy-Event-Type": input.eventType,
        "Contrazy-Api-Version": PARTNER_WEBHOOK_API_VERSION,
        "Contrazy-Delivery-Attempt": String(input.attempt),
      },
      body: input.rawBody,
    })
    const bodySnippet = await readResponseSnippet(response)
    const ok = isSuccessfulWebhookStatus(response.status)

    return {
      ok,
      status: response.status,
      bodySnippet,
      error: ok ? null : `Endpoint responded with HTTP ${response.status}.`,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return { ok: false, status: null, bodySnippet: null, error: describeError(error), durationMs: Date.now() - startedAt }
  }
}
