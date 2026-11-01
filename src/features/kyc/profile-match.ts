import type { VerifiedIdentityOutputs } from "@/lib/integrations/stripe-gateway"

/**
 * Partner bookings (LOCAZ, QA V-03): the person Stripe Identity verified must be the customer the partner sent. Names
 * are compared leniently (case, accents, hyphens and apostrophes ignored; one given name and one family name in common
 * are enough, so "Jean-Pierre" matches "Jean Pierre" and a second given name on the document is fine). The birth date
 * must be equal when both sides have one.
 *
 * Client-safe: no Node-only imports.
 */

export type ProfileForMatch = { firstName: string | null; lastName: string | null; birthDate: string | null }

export type ProfileMatch =
  | { status: "matched" }
  /** Nothing to compare (Stripe gave no name, or the profile has none): the verification stands, the event says why. */
  | { status: "skipped"; reason: "no_verified_outputs" | "no_profile_name" }
  | { status: "mismatch"; reason: "name" | "birth_date" }

/** The summary stored on a refused check, read back by the partner checkout as the failure reason. */
export const PROFILE_MISMATCH_PREFIX = "profile_mismatch:"

function nameTokens(value: string | null): string[] {
  if (!value) return []
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // "D'Amico" is often typed "Damico": apostrophes join, other separators split.
    .replace(/['’`]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0)
}

/** One name in common, or the same letters once separators are dropped ("Recettepro" and "Recette-Pro"). */
function sameName(a: string[], b: string[]) {
  return a.some((token) => b.includes(token)) || (a.length > 0 && a.join("") === b.join(""))
}

export function matchIdentityToProfile(outputs: VerifiedIdentityOutputs | null, profile: ProfileForMatch): ProfileMatch {
  if (!outputs || (!outputs.firstName && !outputs.lastName)) return { status: "skipped", reason: "no_verified_outputs" }
  const profileFirst = nameTokens(profile.firstName)
  const profileLast = nameTokens(profile.lastName)
  if (!profileFirst.length || !profileLast.length) return { status: "skipped", reason: "no_profile_name" }

  const verifiedFirst = nameTokens(outputs.firstName)
  const verifiedLast = nameTokens(outputs.lastName)
  // Some documents put every name in one field: compare against all of the verified names as well.
  const verifiedAll = [...verifiedFirst, ...verifiedLast]
  const firstOk = sameName(profileFirst, verifiedFirst.length ? verifiedFirst : verifiedAll) || sameName(profileFirst, verifiedAll)
  const lastOk = sameName(profileLast, verifiedLast.length ? verifiedLast : verifiedAll) || sameName(profileLast, verifiedAll)
  if (!firstOk || !lastOk) return { status: "mismatch", reason: "name" }

  if (outputs.dob && profile.birthDate && outputs.dob !== profile.birthDate.slice(0, 10)) return { status: "mismatch", reason: "birth_date" }
  return { status: "matched" }
}
