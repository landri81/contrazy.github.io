import type { PartnerApiKey, VendorProfile } from "@prisma/client"
import { z } from "zod"

import { CardWindowError, detachCustomerCards, markVehicleReturned } from "@/features/card-security/server/card-window"
import { buildCardSecuritySummary } from "@/features/partner-api/booking-presenter"
import { isoDateTime } from "@/features/partner-api/schemas/booking.schema"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import { PartnerApiError } from "@/lib/partner-api/errors"

export const partnerBookingReturnedSchema = z.object({ returnedAt: isoDateTime("returnedAt") })
export const partnerDetachCardSchema = z.object({}).strict()

type Caller = { vendorProfile: VendorProfile; apiKey: Pick<PartnerApiKey, "id" | "prefix"> }

function toPartnerError(error: unknown): never {
  if (error instanceof CardWindowError) {
    throw new PartnerApiError(error.code, error.message, { details: error.details })
  }

  throw error
}

/** The vehicle is back: starts the 90-day charge window (`windowEndsAt = returnedAt + 90 days`). */
export async function markPartnerBookingReturned(caller: Caller, bookingId: string, input: z.infer<typeof partnerBookingReturnedSchema>) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  const returnedAt = new Date(input.returnedAt)

  if (returnedAt.getTime() > Date.now() + 5 * 60_000) {
    throw new PartnerApiError("invalid_request", "returnedAt cannot be in the future.", { details: { issues: [{ path: "returnedAt", message: "must not be in the future" }] } })
  }

  await markVehicleReturned(prisma, { transactionId: booking.id, returnedAt }).catch(toPartnerError)
  const updated = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })

  return { bookingId: updated.id, externalRef: updated.externalRef, cardSecurity: buildCardSecuritySummary(updated) }
}

/** Detaches the customer's saved cards when no booking still needs them (409 card_in_use otherwise). */
export async function detachPartnerCustomerCards(caller: Caller, customerId: string) {
  const customer = await prisma.partnerCustomer.findFirst({ where: { id: customerId, vendorId: caller.vendorProfile.id } })

  if (!customer) {
    throw new PartnerApiError("not_found", "No customer matches this id for this vendor.")
  }

  if (!caller.vendorProfile.stripeAccountId) {
    throw new PartnerApiError("stripe_not_connected", "Connect a Stripe account first.")
  }

  const { detached } = await detachCustomerCards(prisma, stripeGateway, { partnerCustomer: customer, account: caller.vendorProfile.stripeAccountId }).catch(toPartnerError)

  return { customerId: customer.id, detached }
}
