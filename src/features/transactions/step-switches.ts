// Client-safe: no Node-only imports, so the client flow and dashboard can share it.

/**
 * Per-booking step switches sent by partners (LOCAZ) when creating a booking.
 * Dashboard transactions store `null` and keep the legacy behaviour, where the
 * flow is derived only from the transaction configuration.
 */
export const STEP_SWITCH_KEYS = [
  "identity",
  "selfie",
  "documents",
  "contract",
  "checkIn",
  "checkOut",
  "payment",
  "cardSecurity",
  "hold",
] as const

export type StepSwitchKey = (typeof STEP_SWITCH_KEYS)[number]
export type StepSwitches = Record<StepSwitchKey, boolean>

export const DEFAULT_STEP_SWITCHES: StepSwitches = {
  identity: false,
  selfie: false,
  documents: false,
  contract: false,
  checkIn: false,
  checkOut: false,
  payment: false,
  cardSecurity: false,
  hold: false,
}

export function isStepSwitchKey(value: unknown): value is StepSwitchKey {
  return typeof value === "string" && (STEP_SWITCH_KEYS as readonly string[]).includes(value)
}

/** Reads the `Transaction.stepSwitches` JSON. Returns null for legacy/dashboard transactions. */
export function parseStepSwitches(value: unknown): StepSwitches | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>

  return STEP_SWITCH_KEYS.reduce<StepSwitches>(
    (switches, key) => ({ ...switches, [key]: record[key] === true }),
    { ...DEFAULT_STEP_SWITCHES }
  )
}

export function mergeStepSwitches(current: StepSwitches, patch: Partial<StepSwitches> | null | undefined): StepSwitches {
  if (!patch) {
    return { ...current }
  }

  return STEP_SWITCH_KEYS.reduce<StepSwitches>(
    (switches, key) => ({
      ...switches,
      [key]: typeof patch[key] === "boolean" ? (patch[key] as boolean) : current[key],
    }),
    { ...current }
  )
}

export function getChangedStepSwitchKeys(current: StepSwitches, next: StepSwitches) {
  return STEP_SWITCH_KEYS.filter((key) => current[key] !== next[key])
}

/** True only when the booking carries switches and this one is explicitly off. */
export function isStepSwitchedOff(switches: StepSwitches | null, key: StepSwitchKey) {
  return switches !== null && switches[key] === false
}

type ClientFlowStepKey =
  | "profile"
  | "kyc"
  | "documents"
  | "details"
  | "contract"
  | "sign"
  | "check-in"
  | "payment"
  | "complete"
  | "check-out"

/**
 * Client flow steps that are switched off for this booking, in flow order.
 * The client shell lists them as "not required" so the customer sees the full
 * picture without having to pass through them.
 */
export function getNotRequiredClientSteps(switches: StepSwitches | null): ClientFlowStepKey[] {
  if (!switches) {
    return []
  }

  const steps: ClientFlowStepKey[] = []

  if (!switches.identity) steps.push("kyc")
  if (!switches.documents) steps.push("documents")
  if (!switches.contract) steps.push("contract", "sign")
  if (!switches.checkIn) steps.push("check-in")
  if (!switches.payment && !switches.hold && !switches.cardSecurity) steps.push("payment")
  if (!switches.checkOut) steps.push("check-out")

  return steps
}
