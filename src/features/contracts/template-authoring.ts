import {
  normalizeContractTemplateMarkup,
  stripContractMarkup,
} from "@/features/contracts/contract-content"

export type ContractMergeField = {
  label: string
  token: string
  description: string
  sampleValue: string
}

export type ContractMergeFieldGroup = {
  label: string
  fields: ContractMergeField[]
}

const signatureContractMergeFieldGroup: ContractMergeFieldGroup = {
  label: "Signature",
  fields: [
    {
      label: "Signer name",
      token: "{{signerName}}",
      description: "Name typed by the signer during contract acceptance.",
      sampleValue: "Alex Morgan",
    },
    {
      label: "Signed date",
      token: "{{signedDate}}",
      description: "Formatted signature date in the transaction timezone.",
      sampleValue: "05 May 2026",
    },
    {
      label: "Signed time",
      token: "{{signedTime}}",
      description: "Formatted signature time in 24-hour notation.",
      sampleValue: "14:30:00",
    },
    {
      label: "Signed timestamp",
      token: "{{signedTimestamp}}",
      description: "ISO timestamp captured at signature completion.",
      sampleValue: "2026-05-05T14:30:00.000Z",
    },
  ],
}

const legacyClientNameMergeField: ContractMergeField = {
  label: "Client name",
  token: "{{clientName}}",
  description: "Legacy full client name token retained for existing templates.",
  sampleValue: "Alex Morgan",
}

export const contractMergeFieldGroups: ContractMergeFieldGroup[] = [
  {
    label: "Client",
    fields: [
      {
        label: "Client first name",
        token: "{{clientFirstName}}",
        description: "Client first name only.",
        sampleValue: "Alex",
      },
      {
        label: "Client last name",
        token: "{{clientLastName}}",
        description: "Client last name only.",
        sampleValue: "Morgan",
      },
      {
        label: "Client birth city",
        token: "{{clientBirthCity}}",
        description: "City of birth captured in the client profile step.",
        sampleValue: "Nice",
      },
      {
        label: "Client birth date",
        token: "{{clientBirthDate}}",
        description: "Date of birth captured in the client profile step.",
        sampleValue: "05 May 1992",
      },
      {
        label: "Client email",
        token: "{{clientEmail}}",
        description: "Primary email used in the client flow.",
        sampleValue: "alex@example.com",
      },
      {
        label: "Client phone",
        token: "{{clientPhone}}",
        description: "Phone number captured from the client form.",
        sampleValue: "+33 6 12 34 56 78",
      },
      {
        label: "Client company",
        token: "{{clientCompany}}",
        description: "Client company name when collected for the transaction.",
        sampleValue: "Northline Studio",
      },
      {
        label: "Client address",
        token: "{{clientAddress}}",
        description: "Street or mailing address captured in the client form.",
        sampleValue: "28 Rue de Lille",
      },
      {
        label: "Client country",
        token: "{{clientCountry}}",
        description: "Country selected by the client.",
        sampleValue: "France",
      },
    ],
  },
  {
    label: "Vendor",
    fields: [
      {
        label: "Business name",
        token: "{{vendorName}}",
        description: "Vendor business name from the connected workspace profile.",
        sampleValue: "Polarsoft BD",
      },
    ],
  },
  {
    label: "Transaction",
    fields: [
      {
        label: "Reference",
        token: "{{transactionReference}}",
        description: "Unique transaction reference shown to vendor and client.",
        sampleValue: "TX-2048-A",
      },
      {
        label: "Service amount",
        token: "{{paymentAmount}}",
        description: "Final service amount formatted in major currency units.",
        sampleValue: "3200.00",
      },
      {
        label: "Deposit amount",
        token: "{{depositAmount}}",
        description: "Authorized deposit amount formatted in major currency units.",
        sampleValue: "800.00",
      },
      {
        label: "Signature city",
        token: "{{signatureCity}}",
        description: "Vendor-defined city of signature for this transaction.",
        sampleValue: "Paris",
      },
      {
        label: "Service date",
        token: "{{serviceDate}}",
        description: "Vendor-defined date of service for this transaction.",
        sampleValue: "12 May 2026",
      },
    ],
  },
  {
    label: "Rental",
    fields: [
      {
        label: "Vehicle",
        token: "{{rental.vehicle}}",
        description: "Vehicle model and category sent with a partner booking.",
        sampleValue: "Peugeot 208 (Compact)",
      },
      {
        label: "Plate",
        token: "{{rental.plate}}",
        description: "Vehicle registration plate.",
        sampleValue: "AB-123-CD",
      },
      {
        label: "Rental start",
        token: "{{rental.start}}",
        description: "Pick-up date and time in the booking timezone.",
        sampleValue: "12 May 2026, 09:00 (Europe/Paris)",
      },
      {
        label: "Rental end",
        token: "{{rental.end}}",
        description: "Return date and time in the booking timezone.",
        sampleValue: "15 May 2026, 18:00 (Europe/Paris)",
      },
      {
        label: "Pick-up place",
        token: "{{rental.pickupPlace}}",
        description: "Pick-up place and address.",
        sampleValue: "Nice Airport T2, Rue Costes et Bellonte",
      },
      {
        label: "Return place",
        token: "{{rental.returnPlace}}",
        description: "Return place and address.",
        sampleValue: "Nice Airport T2, Rue Costes et Bellonte",
      },
      {
        label: "Included mileage",
        token: "{{rental.kmIncluded}}",
        description: "Included kilometres, or unlimited mileage, with the extra km price.",
        sampleValue: "900 km (€0.25 per extra km)",
      },
      {
        label: "Options",
        token: "{{rental.options}}",
        description: "Booked rental options.",
        sampleValue: "Child seat, Additional driver",
      },
      {
        label: "Protection",
        token: "{{rental.protection}}",
        description: "Selected protection package.",
        sampleValue: "Standard protection",
      },
      {
        label: "Deductible",
        token: "{{rental.deductible}}",
        description: "Deductible amount for the selected protection.",
        sampleValue: "€1,200.00",
      },
      {
        label: "Rental deposit",
        token: "{{rental.deposit}}",
        description: "Security deposit stated in the rental terms.",
        sampleValue: "€800.00",
      },
      {
        label: "Price table",
        token: "{{rental.priceTable}}",
        description: "Price lines with quantity, unit price and total. Place it on its own line.",
        sampleValue: "Rental — 3 days × €45.00 = €135.00; Total: €135.00",
      },
      {
        label: "Mileage at departure",
        token: "{{rental.departureKm}}",
        description: "Odometer read at the check-in (contracts signed at pickup).",
        sampleValue: "48,210 km",
      },
      {
        label: "Fuel at departure",
        token: "{{rental.departureFuel}}",
        description: "Fuel level at the check-in, in eighths.",
        sampleValue: "6/8",
      },
      {
        label: "Check-in time",
        token: "{{rental.departureAt}}",
        description: "When the vehicle was inspected at pickup.",
        sampleValue: "12 November 2026, 09:40 (Europe/Paris)",
      },
      {
        label: "Damage at departure",
        token: "{{rental.departureDamages}}",
        description: "Existing damage reported at the check-in.",
        sampleValue: "Scratch on the rear bumper",
      },
      {
        label: "Departure check (one sentence)",
        token: "{{rental.departureReport}}",
        description: "The check-in readings in one sentence: time, mileage, fuel and damage. Place it on its own line: it is left out of a contract signed before the check-in.",
        sampleValue: "Departure check of 12 November 2026, 09:40: mileage 48,210 km, fuel 6/8. Damage noted: None reported.",
      },
      {
        label: "Vehicle category",
        token: "{{rental.category}}",
        description: "The vehicle's category on its own (car, van, truck…).",
        sampleValue: "Utilitaire 3 m³",
      },
      {
        label: "Fuel type",
        token: "{{rental.fuel}}",
        description: "The vehicle's fuel as the partner names it.",
        sampleValue: "Diesel",
      },
      {
        label: "Main driver licence number",
        token: "{{rental.mainDriverLicence}}",
        description: "The driving licence number of the main driver.",
        sampleValue: "12AB34567",
      },
      {
        label: "Additional drivers",
        token: "{{rental.extraDrivers}}",
        description: "Each additional driver with their licence number, or the sentence saying none is authorised. Place it on its own line: it is left out when the partner sends no driver list.",
        sampleValue: "Additional drivers authorised: Marie Durand (licence no. 98CD76543).",
      },
      {
        label: "Renting company (one sentence)",
        token: "{{rental.company}}",
        description: "\"On behalf of the company … (SIRET …, VAT no. …)\". Place it on its own line: it is left out for a person renting.",
        sampleValue: "On behalf of the company Transports Exemple SAS (SIRET 12345678900012, VAT no. FR12345678900).",
      },
      {
        label: "Company name",
        token: "{{rental.companyName}}",
        description: "The renting company of a company booking.",
        sampleValue: "Transports Exemple SAS",
      },
      {
        label: "Company SIRET",
        token: "{{rental.companySiret}}",
        description: "The renting company's SIRET number.",
        sampleValue: "12345678900012",
      },
      {
        label: "Company VAT number",
        token: "{{rental.companyVat}}",
        description: "The renting company's intra-EU VAT number.",
        sampleValue: "FR12345678900",
      },
      {
        label: "Terms link",
        token: "{{rental.termsLink}}",
        description: "The partner's published terms, as a link the signer can open.",
        sampleValue: "https://locaz.co/legal/terms",
      },
      {
        label: "Late return fee",
        token: "{{rental.lateFee}}",
        description: "The partner's late-return rule, in the booking's language.",
        sampleValue: "15,00 € per started hour, at most 90,00 € per day",
      },
    ],
  },
  signatureContractMergeFieldGroup,
]

export const contractMergeFields = [legacyClientNameMergeField, ...contractMergeFieldGroups.flatMap((group) => group.fields)]
export const vendorContractMergeFieldGroups = contractMergeFieldGroups.filter(
  (group) => group !== signatureContractMergeFieldGroup
)

export const contractEditorSnippets = [
  {
    label: "Section",
    description: "Insert a numbered section with a heading and body copy.",
    content: "\n1. Section title\nAdd the section details here.\n",
  },
  {
    label: "Clause",
    description: "Insert a plain clause paragraph block.",
    content: "\nClause:\nDescribe the obligation, timeline, or commercial term here.\n",
  },
  {
    label: "Bullets",
    description: "Insert a short bullet list.",
    content: "\n- First point\n- Second point\n- Third point\n",
  },
  {
    label: "Payment",
    description: "Insert a payment clause with dynamic transaction values.",
    content:
      "\nPayment terms:\nThe client agrees to pay {{paymentAmount}} for transaction {{transactionReference}}.\n",
  },
  {
    label: "Deposit",
    description: "Insert a deposit clause using the authorized amount placeholder.",
    content:
      "\nDeposit terms:\nAn authorized deposit of {{depositAmount}} may be held and managed under the agreed terms.\n",
  },
]

export const defaultContractTemplateContent = [
  "<h1>Service agreement</h1>",
  "<p>This agreement is entered into between {{vendorName}} and {{clientFirstName}} {{clientLastName}} for transaction {{transactionReference}}.</p>",
  "<h2>Scope</h2>",
  "<p>Describe the service, rental, or engagement covered by this agreement.</p>",
  "<h2>Payment</h2>",
  "<p>The service amount is {{paymentAmount}}. If a deposit is authorized, the amount is {{depositAmount}}.</p>",
  "<h2>Acceptance</h2>",
  "<p>The client will review and sign this agreement during the final confirmation step.</p>",
].join("")

export function renderContractTemplateSample(content: string) {
  const normalized = normalizeContractTemplateMarkup(content)

  return contractMergeFields.reduce((acc, field) => acc.replaceAll(field.token, field.sampleValue), normalized)
}

export function summarizeContractTemplate(content: string) {
  return stripContractMarkup(renderContractTemplateSample(content)).replace(/\s+/g, " ").trim()
}
