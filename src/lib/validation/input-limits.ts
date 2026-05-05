export const INPUT_LIMITS = {
  personName: 100,
  businessName: 120,
  email: 254,
  password: 128,
  phone: 32,
  address: 160,
  country: 80,
  registrationNumber: 64,
  vatNumber: 64,
  transactionTitle: 140,
  transactionNotes: 500,
  contractTemplateName: 120,
  contractTemplateDescription: 180,
  contractContent: 20_000,
  checklistName: 120,
  checklistDescription: 180,
  checklistItemLabel: 120,
  checklistItemInstructions: 240,
  linkTitle: 140,
  linkNotes: 500,
  cancelReason: 300,
  disputeSummary: 1_000,
  adminDisputeResolution: 1_500,
  clientCompanyName: 120,
} as const

export const PHONE_REGEX = /^\+[1-9]\d{0,2}[\s\-]?\d{4,14}$/

export const PASSWORD_MIN_LENGTH = 12
export const LOGIN_PASSWORD_MIN_LENGTH = 8
export const MIN_DISPUTE_SUMMARY_LENGTH = 10
