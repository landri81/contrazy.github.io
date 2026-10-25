import type { PartnerApiKey, PostChargeType, VendorProfile } from "@prisma/client"
import { z } from "zod"

import { createPostCharge, PostChargeError } from "@/features/card-security/server/post-charges"
import { presentPartnerCharge } from "@/features/partner-api/booking-presenter"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import { PartnerApiError } from "@/lib/partner-api/errors"

export const PARTNER_CHARGE_TYPES = ["damage", "fuel", "toll", "towing", "fps", "ticket_admin_fee", "other"] as const

export const partnerChargeCreateSchema = z.object({
  type: z.enum(PARTNER_CHARGE_TYPES),
  amount: z.number().int("amount must be whole cents").positive("amount must be greater than zero").max(1_000_000),
  description: z.string().trim().max(500).optional().nullable(),
  proofUrls: z.array(z.string().trim().url("proofUrls must be absolute URLs").refine((url) => /^https:\/\//i.test(url), "proofUrls must use https")).max(10).optional(),
  externalRef: z.string().trim().min(1).max(100).optional().nullable(),
})

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
