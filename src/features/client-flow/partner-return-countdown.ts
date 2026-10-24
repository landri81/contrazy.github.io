// Client-safe state machine for the partner "Return to …" countdown.

export const PARTNER_RETURN_COUNTDOWN_SECONDS = 5

/**
 * - `idle`: motion preference not known yet (server render, first paint): no
 *   countdown, no redirect, only the button.
 * - `counting`: visible countdown, redirects when it reaches 0.
 * - `manual`: reduced motion requested, so no countdown and no automatic
 *   redirect; the customer uses the button.
 * - `stopped`: the customer chose to stay on the page.
 * - `redirecting`: the countdown ended; the page navigates to the partner.
 */
export type PartnerReturnCountdownState = {
  phase: "idle" | "counting" | "manual" | "stopped" | "redirecting"
  remaining: number
}

export type PartnerReturnCountdownAction =
  | { type: "start"; reducedMotion: boolean }
  | { type: "tick" }
  | { type: "stop" }

export const initialPartnerReturnCountdown: PartnerReturnCountdownState = {
  phase: "idle",
  remaining: PARTNER_RETURN_COUNTDOWN_SECONDS,
}

export function partnerReturnCountdownReducer(
  state: PartnerReturnCountdownState,
  action: PartnerReturnCountdownAction
): PartnerReturnCountdownState {
  switch (action.type) {
    case "start":
      if (state.phase !== "idle") {
        return state
      }

      return action.reducedMotion
        ? { phase: "manual", remaining: state.remaining }
        : { phase: "counting", remaining: PARTNER_RETURN_COUNTDOWN_SECONDS }
    case "tick": {
      if (state.phase !== "counting") {
        return state
      }

      const remaining = Math.max(0, state.remaining - 1)
      return remaining === 0 ? { phase: "redirecting", remaining } : { phase: "counting", remaining }
    }
    case "stop":
      return state.phase === "counting" ? { phase: "stopped", remaining: state.remaining } : state
    default:
      return state
  }
}
