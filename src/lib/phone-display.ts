import { parsePhoneNumberFromString } from "libphonenumber-js"

/**
 * A phone number as people read it ("+33 7 44 71 22 73"). The phone field stores the international form
 * (+33744712273); a number typed another way is shown as typed (LOCAZ live test, 8 Nov 2026). The library itself, not
 * react-phone-number-input: e-mails are sent from API routes, where React components cannot load.
 */
export function displayPhone(value: string) {
  const trimmed = value.trim()
  return (/^\+\d{6,15}$/.test(trimmed) ? parsePhoneNumberFromString(trimmed)?.formatInternational() : undefined) || trimmed
}
