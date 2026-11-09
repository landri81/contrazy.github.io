import { formatPhoneNumberIntl } from "react-phone-number-input"

/**
 * A phone number as people read it ("+33 7 44 71 22 73"). The phone field stores the international form
 * (+33744712273); a number it cannot read is shown as typed (LOCAZ live test, 8 Nov 2026).
 */
export function displayPhone(value: string) {
  const trimmed = value.trim()
  return formatPhoneNumberIntl(trimmed) || trimmed
}
