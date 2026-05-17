export const requirementTypeOptions = [
  { value: "DOCUMENT", label: "Document" },
  { value: "PHOTO", label: "Photo" },
  { value: "CAPTURE", label: "Live capture" },
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

const requirementFileSlotTypes = new Set<RequirementTypeValue>(["DOCUMENT", "PHOTO", "CAPTURE"])

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

export function requirementSupportsFileSlots(type: RequirementTypeValue | string) {
  return requirementFileSlotTypes.has(type as RequirementTypeValue)
}

export function normalizeRequirementFileCount(
  type: RequirementTypeValue | string,
  value: unknown
) {
  if (!requirementSupportsFileSlots(type)) {
    return 1
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.trunc(parsed)
}

export function parseRequirementFileSlotLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) =>
    typeof entry === "string" && entry.trim().length > 0 ? [entry.trim()] : []
  )
}

export function normalizeRequirementFileSlotLabels(input: {
  type: RequirementTypeValue | string
  fileCount: number
  labels: unknown
  requirementLabel?: string | null
}) {
  if (!requirementSupportsFileSlots(input.type)) {
    return []
  }

  const parsedLabels = parseRequirementFileSlotLabels(input.labels)
  const normalizedRequirementLabel = input.requirementLabel?.trim() || "File"

  return Array.from({ length: input.fileCount }, (_, index) => {
    const provided = parsedLabels[index]?.trim()

    if (provided) {
      return provided
    }

    if (input.fileCount === 1) {
      return normalizedRequirementLabel
    }

    return `${normalizedRequirementLabel} ${index + 1}`
  })
}

export function isRequirementSlotSatisfied(
  requirement: {
    id: string
    type: RequirementTypeValue | string
    requiredFileCount?: number | null
  },
  documents: Array<{
    requirementId?: string | null
    slotIndex?: number | null
    assetUrl?: string | null
    publicId?: string | null
    textValue?: string | null
  }>
) {
  if (requirement.type === "TEXT") {
    return documents.some(
      (document) =>
        document.requirementId === requirement.id && Boolean(document.textValue?.trim())
    )
  }

  const requiredFileCount = normalizeRequirementFileCount(
    requirement.type,
    requirement.requiredFileCount
  )

  for (let slotIndex = 0; slotIndex < requiredFileCount; slotIndex += 1) {
    const hasSlot = documents.some(
      (document) =>
        document.requirementId === requirement.id &&
        (document.slotIndex ?? 0) === slotIndex &&
        Boolean(document.assetUrl && document.publicId)
    )

    if (!hasSlot) {
      return false
    }
  }

  return true
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
