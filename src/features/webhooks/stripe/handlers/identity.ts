import type Stripe from "stripe"

import { matchIdentityToProfile, PROFILE_MISMATCH_PREFIX, type ProfileMatch } from "@/features/kyc/profile-match"
import { resolveSelfieOutcome, SELFIE_NOT_REQUESTED } from "@/features/kyc/selfie-check"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

function extractIdentityContext(session: Stripe.Identity.VerificationSession) {
  return {
    transactionId: session.metadata?.transactionId ?? null,
    vendorId: session.metadata?.vendorId ?? null,
  }
}

/**
 * Handles `identity.verification_session.verified`.
 *
 * Acts as a reliable server-side safety net — the return page handles the
 * happy path synchronously, but if the customer closes their browser after
 * completing verification the webhook ensures the DB is updated.
 *
 * The `kycVerificationsUsed` increment is guarded: if the return page already
 * marked the record VERIFIED, the increment is skipped to avoid double-counting.
 *
 * When the session asked for a selfie (C4), a verified session means the selfie
 * matched too; the outcome is stored as `selfieCheck` before the KYC event is
 * recorded, so the partner webhook built from that event carries it.
 *
 * Partner bookings (LOCAZ, QA V-03): the name and birth date Stripe read must be
 * the customer's the partner sent; otherwise the check is stored as FAILED with
 * the reason, and the customer is asked to verify again.
 */
export async function handleIdentitySessionVerified(
  session: Stripe.Identity.VerificationSession,
  eventId: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId } = extractIdentityContext(session)

  if (!transactionId || !vendorId) {
    return { vendorId: null, transactionId: null }
  }

  const selfie = (await resolveSelfieOutcome(session, stripeGateway)) ?? SELFIE_NOT_REQUESTED
  const match = await partnerProfileMatch(transactionId, session.id)

  if (match?.status === "mismatch") {
    await recordProfileMismatch(transactionId, session, eventId, match.reason, selfie)
    return { vendorId, transactionId }
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.kycVerification.findUnique({
      where: { transactionId },
      select: { status: true },
    })

    if (match?.status === "skipped") {
      await recordTransactionEvent(tx, {
        transactionId,
        type: "WEBHOOK_PROCESSED",
        title: "Identity not compared with the profile",
        detail: `Profile match skipped (${match.reason}) for session ${session.id}.`,
        dedupeKey: `event:kyc-profile-skipped:${transactionId}:${session.id}`,
      })
    }

    if (!current) {
      // Return page hasn't created the record yet — create it.
      await tx.kycVerification.create({
        data: {
          transactionId,
          provider: "Stripe Identity",
          status: "VERIFIED",
          providerReference: session.id,
          verifiedAt: new Date(),
          ...selfie,
        },
      })
    } else {
      await tx.kycVerification.update({
        where: { transactionId },
        data: {
          status: "VERIFIED",
          providerReference: session.id,
          verifiedAt: new Date(),
          ...selfie,
        },
      })
    }

    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "KYC_VERIFIED" },
    })

    // Only increment if not already counted by the return page.
    if (current?.status !== "VERIFIED") {
      await incrementVendorSubscriptionUsage(tx, vendorId, "kycVerificationsUsed")
    }

    await recordTransactionEvent(tx, {
      transactionId,
      type: "KYC_VERIFIED",
      title: "Identity verification confirmed via webhook",
      detail: `Stripe Identity webhook confirmed verification for session ${session.id}.`,
      dedupeKey: `event:kyc-verified:${transactionId}`,
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Identity webhook processed",
      detail: `identity.verification_session.verified processed for ${session.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, sessionId: session.id },
    })
  })

  return { vendorId, transactionId }
}

/**
 * Handles `identity.verification_session.requires_input`.
 *
 * Fires when the customer's verification attempt failed or needs re-submission.
 * Only updates status if the session is not already VERIFIED. When a selfie was
 * requested, the selfie outcome and its Stripe error code (for example
 * `selfie_face_mismatch`) are stored alongside.
 */
export async function handleIdentitySessionRequiresInput(
  session: Stripe.Identity.VerificationSession,
  eventId: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId } = extractIdentityContext(session)

  if (!transactionId || !vendorId) {
    return { vendorId: null, transactionId: null }
  }

  const selfie = (await resolveSelfieOutcome(session, stripeGateway)) ?? SELFIE_NOT_REQUESTED

  await prisma.$transaction(async (tx) => {
    const current = await tx.kycVerification.findUnique({
      where: { transactionId },
      select: { status: true },
    })

    // Don't downgrade a successfully verified record.
    if (current?.status === "VERIFIED") {
      return
    }

    if (!current) {
      await tx.kycVerification.create({
        data: {
          transactionId,
          provider: "Stripe Identity",
          status: "FAILED",
          providerReference: session.id,
          summary: session.last_error?.reason ?? "requires_input",
          ...selfie,
        },
      })
    } else {
      await tx.kycVerification.update({
        where: { transactionId },
        data: {
          status: "FAILED",
          providerReference: session.id,
          summary: session.last_error?.reason ?? "requires_input",
          ...selfie,
        },
      })
    }

    await recordTransactionEvent(tx, {
      transactionId,
      type: "KYC_FAILED",
      title: "Identity verification requires re-submission",
      detail: session.last_error?.reason
        ? `Reason: ${session.last_error.reason}`
        : "The verification session requires additional input.",
      dedupeKey: `event:kyc-failed:${transactionId}:${session.id}`,
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Identity webhook processed",
      detail: `identity.verification_session.requires_input processed for ${session.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, sessionId: session.id },
    })
  })

  return { vendorId, transactionId }
}

/** Partner bookings only: the verified person compared with the customer the partner sent (null for other bookings). */
async function partnerProfileMatch(transactionId: string, sessionId: string): Promise<ProfileMatch | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { source: true, clientProfile: { select: { firstName: true, lastName: true, birthDate: true } } },
  })
  if (transaction?.source !== "PARTNER_API") return null
  // Without Stripe's outputs (permission, network) the verification stands; the event records that it was not compared.
  const outputs = await stripeGateway.identity.retrieveVerifiedOutputs(sessionId).catch(() => null)
  const profile = transaction.clientProfile
  return matchIdentityToProfile(outputs, {
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    birthDate: profile?.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
  })
}

/** A verified document of someone else: stored as FAILED with the reason, so the partner shows it and asks again. */
async function recordProfileMismatch(
  transactionId: string,
  session: Stripe.Identity.VerificationSession,
  eventId: string,
  reason: "name" | "birth_date",
  selfie: Awaited<ReturnType<typeof resolveSelfieOutcome>> | typeof SELFIE_NOT_REQUESTED
) {
  const summary = `${PROFILE_MISMATCH_PREFIX}${reason}`
  await prisma.$transaction(async (tx) => {
    await tx.kycVerification.upsert({
      where: { transactionId },
      create: { transactionId, provider: "Stripe Identity", status: "FAILED", providerReference: session.id, summary, ...(selfie ?? SELFIE_NOT_REQUESTED) },
      update: { status: "FAILED", providerReference: session.id, verifiedAt: null, summary, ...(selfie ?? SELFIE_NOT_REQUESTED) },
    })
    await recordTransactionEvent(tx, {
      transactionId,
      type: "KYC_FAILED",
      title: "Identity does not match the customer",
      detail: reason === "name" ? "The name on the verified document differs from the customer's." : "The birth date on the verified document differs from the customer's.",
      dedupeKey: `event:kyc-failed:${transactionId}:${session.id}`,
    })
    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Identity webhook processed",
      detail: `identity.verification_session.verified processed for ${session.id} (profile mismatch: ${reason}).`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, sessionId: session.id },
    })
  })
}
