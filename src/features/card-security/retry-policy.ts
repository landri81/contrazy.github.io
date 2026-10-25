/**
 * What to do after an off-session charge attempt failed (Spec v2.1 §9). Card
 * networks fine merchants that retry declined merchant-initiated charges too
 * often, so the next step depends on the decline type:
 *
 * | Decline                                              | Off-session retry          | Then                         |
 * | insufficient_funds, try_again_later, processing_error | yes, max 3: 24 h, 48 h, 72 h | payment link                 |
 * | card_declined (generic), do_not_honor, unknown codes  | once, after 72 h            | payment link                 |
 * | authentication_required                               | never                       | payment link now (3DS)       |
 * | expired_card, incorrect_number                        | never                       | card-update link, then charge |
 * | lost_card, stolen_card, pickup_card, fraudulent       | never                       | payment link + review flag   |
 * | processing                                            | no                          | wait for the webhook         |
 */

export type ChargeNextAction =
  | { kind: "retry"; afterHours: number }
  | { kind: "payment_link"; reviewFlag: boolean }
  | { kind: "card_update_link" }
  | { kind: "wait" }

const SOFT_DECLINES = new Set(["insufficient_funds", "try_again_later", "processing_error"])
const UPDATE_CARD = new Set(["expired_card", "incorrect_number", "invalid_number", "invalid_expiry_month", "invalid_expiry_year"])
const REVIEW = new Set(["lost_card", "stolen_card", "pickup_card", "fraudulent", "merchant_blacklist"])

/** Hours before retry n+1 of a soft decline (after attempts 1, 2 and 3). */
export const SOFT_DECLINE_RETRY_HOURS = [24, 48, 72] as const
export const GENERIC_DECLINE_RETRY_HOURS = 72

/**
 * `declineCode` is Stripe's `decline_code`, or the error `code` when there is
 * none; `attempt` is the number of the attempt that just failed (1 = first).
 */
export function nextAction(declineCode: string | null | undefined, attempt: number): ChargeNextAction {
  const code = (declineCode ?? "").toLowerCase()

  if (code === "processing") {
    return { kind: "wait" }
  }

  if (code === "authentication_required") {
    return { kind: "payment_link", reviewFlag: false }
  }

  if (UPDATE_CARD.has(code)) {
    return { kind: "card_update_link" }
  }

  if (REVIEW.has(code)) {
    return { kind: "payment_link", reviewFlag: true }
  }

  if (SOFT_DECLINES.has(code)) {
    const delay = SOFT_DECLINE_RETRY_HOURS[attempt - 1]
    return delay ? { kind: "retry", afterHours: delay } : { kind: "payment_link", reviewFlag: false }
  }

  // card_declined, generic_decline, do_not_honor and any code we do not know: one late retry.
  return attempt === 1 ? { kind: "retry", afterHours: GENERIC_DECLINE_RETRY_HOURS } : { kind: "payment_link", reviewFlag: false }
}
