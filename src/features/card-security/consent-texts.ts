import { createHash } from "node:crypto"

/**
 * Consent to later off-session charges (Spec v2.1 §6). The French text is the
 * binding version; the English translation is shown alongside for foreign
 * customers. Versions are never edited once used: a wording change is a new
 * version, and every ConsentRecord stores the exact text it showed.
 *
 * v1 is the Spec §6 wording, with the vendor's name and dispute contact in
 * place of "LOCAZ" and "contact@locaz.fr". LEGAL REVIEW PENDING.
 */
export const CURRENT_CARD_CONSENT_VERSION = "card-90d-v1"

type ConsentTemplate = { fr: string; en: string; legalReviewPending: boolean }

const CONSENT_TEMPLATES: Record<string, ConsentTemplate> = {
  "card-90d-v1": {
    fr:
      "J'autorise {vendor} à débiter la carte bancaire enregistrée, sans nouvelle autorisation de ma part, jusqu'à 90 jours après la restitution du véhicule, pour les montants suivants : dommages constatés lors de l'état des lieux de retour, carburant manquant, péages, frais de fourrière, forfaits post-stationnement (FPS) et autres sommes réglées par {vendor} du fait de la location, y compris lorsqu'ils sont notifiés après la restitution, ainsi que les frais de gestion des contraventions prévus par la grille tarifaire en vigueur. Les amendes pour lesquelles je suis désigné comme conducteur me sont adressées directement par l'administration et ne sont pas débitées par {vendor}. Chaque débit me sera notifié avec ses justificatifs et je peux le contester auprès de {vendor} ({contact}).",
    en:
      "I authorise {vendor} to charge my saved payment card, without further authorisation, up to 90 days after the vehicle is returned, for: damage recorded at the return inspection, missing fuel, tolls, towing fees, post-parking charges (FPS) and other sums paid by {vendor} because of the rental, including those notified after return, as well as the traffic-ticket admin fees in the current price schedule. Fines for which I am designated as driver are sent to me directly by the authorities and are not charged by {vendor}. Each charge will be notified to me with supporting documents and I may dispute it with {vendor} ({contact}).",
    legalReviewPending: true,
  },
}

export type RenderedConsentText = {
  version: string
  fr: string
  en: string
  /** SHA-256 of the exact French and English texts shown (Spec §14 `consent_text_hash`). */
  hash: string
  legalReviewPending: boolean
}

function fill(template: string, values: { vendor: string; contact: string }) {
  return template.replaceAll("{vendor}", values.vendor).replaceAll("{contact}", values.contact)
}

/** The exact consent text a customer of `vendorName` sees, with its version and hash. */
export function renderCardConsentText(
  input: { vendorName: string; contactEmail: string },
  version: string = CURRENT_CARD_CONSENT_VERSION
): RenderedConsentText {
  const template = CONSENT_TEMPLATES[version]

  if (!template) {
    throw new Error(`Unknown card consent version: ${version}`)
  }

  const values = { vendor: input.vendorName.trim(), contact: input.contactEmail.trim() }
  const fr = fill(template.fr, values)
  const en = fill(template.en, values)
  const hash = createHash("sha256").update(`${version}\n${fr}\n${en}`, "utf8").digest("hex")

  return { version, fr, en, hash, legalReviewPending: template.legalReviewPending }
}

export class ConsentPartiesMissingError extends Error {
  constructor() {
    super("The vendor needs a business name and a support or business e-mail before customers can consent to card charges.")
  }
}

/**
 * Vendor name and dispute contact named in the consent text. A consent that
 * names no merchant or no contact would not be valid, so both are required.
 */
export function consentPartiesFor(vendor: { businessName: string | null; supportEmail: string | null; businessEmail: string | null }) {
  const vendorName = vendor.businessName?.trim()
  const contactEmail = vendor.supportEmail?.trim() || vendor.businessEmail?.trim()

  if (!vendorName || !contactEmail) {
    throw new ConsentPartiesMissingError()
  }

  return { vendorName, contactEmail }
}
