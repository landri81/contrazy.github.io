import { handleIdentitySessionRequiresInput, handleIdentitySessionVerified } from "@/features/webhooks/stripe/handlers/identity"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"
import { stripeGateway } from "@/lib/integrations/stripe"

/**
 * A PENDING identity check read from Stripe while the partner's page waits on it (embedded checkout). Stripe sends
 * the Identity events to the platform's account webhook, which only logged them until 6 Nov 2026: a check finished on
 * Stripe stayed PENDING and the customer's page waited for ever (LOCAZ, LZ-2026-000277). The webhook now stores them;
 * this keeps a missed or late event from blocking the customer. The result is stored by the webhook handlers, so the
 * same rules apply (partner profile match, selfie, a verified check never downgraded, one quota count).
 *
 * - `settled`: Stripe's result is stored (verified or failed);
 * - `waiting`: Stripe is still processing, or could not be reached;
 * - `unsubmitted`: the session was opened but nothing was sent (Stripe's window closed): the customer starts again.
 */
export type PendingIdentityOutcome = "settled" | "waiting" | "unsubmitted"

export async function syncPendingIdentity(
  kyc: { status: string; providerReference: string | null } | null | undefined,
  gateway: Pick<StripeGateway, "identity"> = stripeGateway
): Promise<PendingIdentityOutcome | null> {
  if (kyc?.status !== "PENDING" || !kyc.providerReference) return null
  const session = await gateway.identity.retrieveVerificationSession(kyc.providerReference).catch(() => null)
  if (!session) return "waiting"

  const eventId = `status-check:${session.id}:${session.status}`
  if (session.status === "verified") {
    await handleIdentitySessionVerified(session, eventId)
    return "settled"
  }
  // A new session is "requires_input" too: only one with Stripe's error (or a cancelled one) has a result.
  if (session.status === "canceled" || (session.status === "requires_input" && session.last_error)) {
    await handleIdentitySessionRequiresInput(session, eventId)
    return "settled"
  }
  return session.status === "requires_input" ? "unsubmitted" : "waiting"
}
