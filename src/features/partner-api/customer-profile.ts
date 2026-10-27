import type { PartnerBookingCreateInput } from "@/features/partner-api/schemas/booking.schema"
import { parseDateOnlyInput } from "@/lib/date-only"

/**
 * The client profile of a partner booking. With the address, birth date and birth place the profile is complete
 * (embedded checkout, M10: the partner's site needs no profile screen); without them Contrazy's pages ask.
 */
export function clientProfileFromPartnerCustomer(customer: PartnerBookingCreateInput["customer"]) {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    fullName: `${customer.firstName} ${customer.lastName}`,
    email: customer.email,
    phone: customer.phone ?? null,
    address: customer.address ? `${customer.address.line1}, ${customer.address.postalCode} ${customer.address.city}` : null,
    country: customer.address?.country ?? null,
    birthDate: customer.birthDate ? parseDateOnlyInput(customer.birthDate) : null,
    birthCity: customer.birthPlace ?? null,
  }
}
