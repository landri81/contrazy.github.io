import type { PartnerApiKey, PostChargeType, VendorProfile } from "@prisma/client"
import type { z } from "zod"

import { createPostCharge, PostChargeError, PostChargeRefundError, refundPostCharge } from "@/features/card-security/server/post-charges"
import { presentPartnerCharge } from "@/features/partner-api/booking-presenter"
import type { partnerChargeCreateSchema, partnerChargeRefundSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import { PartnerApiError } from "@/lib/partner-api/errors"

type Caller = { vendorProfile: VendorProfile; apiKey: Pick<PartnerApiKey, "id" | "prefix"> }

/**
 * Charges the saved card after the rental (Spec v2.1 §7). Hard rules only;
 * LOCAZ applies its own caps before calling. 201 with the charge and its
 * status: a declined card is `failed` with its decline code.
 */
export async function createPartnerCharge(caller: Caller, bookingId: string, input: z.infer<typeof partnerChargeCreateSchema>) {
  if (!caller.vendorProfile.stripeAccountId) {
    throw new PartnerApiError("stripe_not_connected", "Connect a Stripe account before charging cards.")
  }

  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })

  try {
    const charge = await createPostCharge(prisma, stripeGateway, {
      transaction: { ...booking, vendor: caller.vendorProfile },
      charge: { ...input, type: input.type.toUpperCase() as PostChargeType },
    })
    return presentPartnerCharge(charge)
  } catch (error) {
    if (error instanceof PostChargeError) {
      throw new PartnerApiError(error.code, error.message, { details: error.details })
    }

    throw error
  }
}

export async function getPartnerCharge(caller: Caller, chargeId: string) {
  const charge = await prisma.postCharge.findFirst({ where: { id: chargeId, vendorId: caller.vendorProfile.id } })

  if (!charge) {
    throw new PartnerApiError("not_found", "No charge matches this id for this vendor.")
  }

  return presentPartnerCharge(charge)
}

/** Refunds a charge fully (no amount) or partly, at Stripe, with a reason (Spec v2.1 §11). */
export async function refundPartnerCharge(caller: Caller, chargeId: string, input: z.infer<typeof partnerChargeRefundSchema>) {
  const charge = await prisma.postCharge.findFirst({ where: { id: chargeId, vendorId: caller.vendorProfile.id } })

  if (!charge) {
    throw new PartnerApiError("not_found", "No charge matches this id for this vendor.")
  }

  if (!caller.vendorProfile.stripeAccountId) {
    throw new PartnerApiError("stripe_not_connected", "Connect a Stripe account first.")
  }

  try {
    const result = await refundPostCharge(prisma, stripeGateway, { charge, account: caller.vendorProfile.stripeAccountId, amount: input.amount, reason: input.reason })
    return { ...presentPartnerCharge(result.charge), refund: { id: result.refund.id, amount: result.refund.amount, reason: result.refund.reason, createdAt: result.refund.createdAt.toISOString() } }
  } catch (error) {
    if (error instanceof PostChargeRefundError) {
      throw new PartnerApiError(error.code, error.message, { details: error.details })
    }

    throw error
  }
}
