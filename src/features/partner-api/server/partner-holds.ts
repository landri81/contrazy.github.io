import { AuditActorType, type PartnerApiKey, type VendorProfile } from "@prisma/client"
import { z } from "zod"

import { PickupHoldError, placePickupHold } from "@/features/card-security/server/pickup-hold"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { buildHold } from "@/features/partner-webhooks/payload"
import { DepositSettlementError, settleDepositHold } from "@/features/transactions/server/deposit-settlement"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import { PartnerApiError } from "@/lib/partner-api/errors"

const MAX_HOLD_CENTS = 1_000_000

const amount = z.number().int("amount must be whole cents").positive("amount must be greater than zero").max(MAX_HOLD_CENTS)

export const partnerHoldCreateSchema = z.object({ amount, force: z.boolean().optional() })
export const partnerHoldCaptureSchema = z.object({ amount: amount.optional() })
export const partnerHoldCancelSchema = z.object({}).strict()

type HoldCaller = { vendorProfile: VendorProfile; apiKey: Pick<PartnerApiKey, "id" | "prefix"> }

async function loadHoldBooking(caller: HoldCaller, bookingId: string) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  return { ...booking, vendor: caller.vendorProfile }
}

async function presentHold(caller: HoldCaller, bookingId: string) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  return { bookingId: booking.id, externalRef: booking.externalRef, hold: buildHold(booking) }
}

function partnerActor(caller: HoldCaller) {
  return { id: null, type: AuditActorType.SYSTEM, via: `partner_api:${caller.apiKey.prefix}` }
}

/** Places the pickup hold on the saved card (Spec v2.1 §5). */
export async function createPartnerHold(caller: HoldCaller, bookingId: string, input: z.infer<typeof partnerHoldCreateSchema>, idempotencyKey: string) {
  if (!caller.vendorProfile.stripeAccountId) {
    throw new PartnerApiError("stripe_not_connected", "Connect a Stripe account before placing holds.")
  }

  const booking = await loadHoldBooking(caller, bookingId)

  try {
    await placePickupHold(prisma, stripeGateway, { transaction: booking, amount: input.amount, force: input.force, idempotencyKey })
  } catch (error) {
    if (error instanceof PickupHoldError) {
      throw new PartnerApiError(error.code, error.message, { details: error.details })
    }

    throw error
  }

  return presentHold(caller, bookingId)
}

/** Captures the hold at return: all of it, or `amount` (≤ authorized) for the damage found. */
export async function settlePartnerHold(
  caller: HoldCaller,
  bookingId: string,
  action: "capture" | "release",
  captureAmount?: number
) {
  const booking = await loadHoldBooking(caller, bookingId)

  try {
    await settleDepositHold(prisma, stripeGateway, { transaction: booking, action, captureAmount, actor: partnerActor(caller) })
  } catch (error) {
    if (error instanceof DepositSettlementError) {
      if (error.code === "invalid_amount") {
        throw new PartnerApiError("invalid_request", "amount must not exceed the authorized hold.", {
          details: { authorized: booking.depositAuthorization?.amount ?? null },
        })
      }

      throw new PartnerApiError("hold_not_active", "This booking has no active hold to settle.", {
        details: { holdStatus: booking.depositAuthorization?.status.toLowerCase() ?? null },
      })
    }

    throw error
  }

  return presentHold(caller, bookingId)
}
