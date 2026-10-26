import { describe, expect, it } from "vitest"

import { nextAction } from "./retry-policy"

describe("nextAction: Spec v2.1 §9 retry policy by decline type", () => {
  it.each(["insufficient_funds", "try_again_later", "processing_error"])("%s: retries 3 times 24 h, 48 h, 72 h apart, then a payment link", (code) => {
    expect(nextAction(code, 1)).toEqual({ kind: "retry", afterHours: 24 })
    expect(nextAction(code, 2)).toEqual({ kind: "retry", afterHours: 48 })
    expect(nextAction(code, 3)).toEqual({ kind: "retry", afterHours: 72 })
    expect(nextAction(code, 4)).toEqual({ kind: "payment_link", reviewFlag: false })
  })

  it.each(["card_declined", "generic_decline", "do_not_honor", "some_new_code", null])("%s: one retry after 72 h, then a payment link", (code) => {
    expect(nextAction(code, 1)).toEqual({ kind: "retry", afterHours: 72 })
    expect(nextAction(code, 2)).toEqual({ kind: "payment_link", reviewFlag: false })
  })

  it("authentication_required: never retried off session, payment link now (on-session 3DS)", () => {
    for (const attempt of [1, 2, 3]) expect(nextAction("authentication_required", attempt)).toEqual({ kind: "payment_link", reviewFlag: false })
  })

  it.each(["expired_card", "incorrect_number"])("%s: never retried, the customer updates the card", (code) => {
    expect(nextAction(code, 1)).toEqual({ kind: "card_update_link" })
    expect(nextAction(code.toUpperCase(), 2)).toEqual({ kind: "card_update_link" })
  })

  it.each(["lost_card", "stolen_card", "pickup_card", "fraudulent"])("%s: never retried, payment link and the booking flagged for review", (code) => {
    expect(nextAction(code, 1)).toEqual({ kind: "payment_link", reviewFlag: true })
  })

  it("processing: waits for the webhook", () => {
    expect(nextAction("processing", 1)).toEqual({ kind: "wait" })
  })
})
