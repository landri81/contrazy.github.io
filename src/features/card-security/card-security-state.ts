import type { CardSecurityStatus } from "@prisma/client"

import { parseStepSwitches } from "@/features/transactions/step-switches"

/**
 * Card security (Spec v2.1 §4): the partner switched `steps.cardSecurity` on
 * for this booking. Dashboard transactions (no switches) never require it.
 */
export function isCardSecurityRequired(transaction: { stepSwitches: unknown }) {
  return parseStepSwitches(transaction.stepSwitches)?.cardSecurity === true
}

/** A card was saved with the customer's consent (status SECURED, set server-side only after a ConsentRecord exists). */
export function hasSecuredCard(transaction: { cardSecurity: { status: CardSecurityStatus } | null }) {
  return transaction.cardSecurity?.status === "SECURED"
}
