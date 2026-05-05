export const requirementTypeOptions = [
  { value: "DOCUMENT", label: "Document" },
  { value: "PHOTO", label: "Photo" },
  { value: "TEXT", label: "Text input" },
] as const

export type RequirementTypeValue = (typeof requirementTypeOptions)[number]["value"]

export const requirementCategoryOptions = [
  { value: "ID", label: "ID" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { value: "DRIVER_LICENSE", label: "Driver license" },
  { value: "COMPANY_REGISTRATION", label: "Company registration" },
  { value: "CONTRACT_ATTACHMENT", label: "Contract attachment" },
  { value: "CUSTOM", label: "Custom document" },
  { value: "OTHER", label: "Other" },
] as const

export type RequirementCategoryValue = (typeof requirementCategoryOptions)[number]["value"]

export const paymentCollectionTimingOptions = [
  {
    value: "AFTER_SIGNING",
    label: "Collect after signing",
    description: "The client pays the service amount during the same secure flow.",
  },
  {
    value: "AFTER_SERVICE",
    label: "Collect after service",
    description: "The client finishes onboarding now and you trigger the service payment later.",
  },
] as const

export type PaymentCollectionTimingValue = (typeof paymentCollectionTimingOptions)[number]["value"]

export function getRequirementCategoryLabel(
  category: RequirementCategoryValue | string,
  customCategoryLabel?: string | null
) {
  if (category === "OTHER" && customCategoryLabel?.trim()) {
    return customCategoryLabel.trim()
  }

  return requirementCategoryOptions.find((option) => option.value === category)?.label ?? "Custom document"
}

export function getPaymentCollectionTimingLabel(value: PaymentCollectionTimingValue | string) {
  return (
    paymentCollectionTimingOptions.find((option) => option.value === value)?.label ??
    "Collect after signing"
  )
}

export function getTextRequirementPlaceholder(category: RequirementCategoryValue | string) {
  switch (category) {
    case "PROOF_OF_ADDRESS":
      return "Enter the address evidence details"
    case "COMPANY_REGISTRATION":
      return "Enter the registration details"
    case "CONTRACT_ATTACHMENT":
      return "Add the attachment notes or reference"
    case "OTHER":
      return "Enter the requested information"
    default:
      return "Type the requested information"
  }
}
