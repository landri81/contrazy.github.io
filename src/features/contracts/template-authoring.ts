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

export const contractMergeFieldGroups: ContractMergeFieldGroup[] = [
  {
    label: "Client",
    fields: [
      {
        label: "Client name",
        token: "{{clientName}}",
        description: "Full client name, using first and last name when available.",
        sampleValue: "Alex Morgan",
      },
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
    ],
  },
  signatureContractMergeFieldGroup,
]

export const contractMergeFields = contractMergeFieldGroups.flatMap((group) => group.fields)
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
  "<p>This agreement is entered into between {{vendorName}} and {{clientName}} for transaction {{transactionReference}}.</p>",
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
