import { clientFlowTransactionInclude } from "@/features/client-flow/server/client-flow-data"
import { presentPartnerCheckout } from "@/features/partner-api/checkout-presenter"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { PartnerApiError } from "@/lib/partner-api/errors"
import { prisma } from "@/lib/db/prisma"

/** Embedded checkout (M10): the partner drives the customer's steps on its own site; see the API README. */

type Caller = { vendorProfile: { id: string } }

/** The booking as the customer flow sees it (same include as Contrazy's pages), for this vendor only. */
export async function loadCheckoutTransaction(caller: Caller, bookingId: string) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  const transaction = await prisma.transaction.findUnique({ where: { id: booking.id }, include: clientFlowTransactionInclude })
  if (!transaction) throw new PartnerApiError("not_found", "No booking matches this reference for this vendor.")
  return transaction
}

/** `GET /bookings/:id/checkout`. */
export async function getPartnerCheckout(caller: Caller, bookingId: string) {
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}
