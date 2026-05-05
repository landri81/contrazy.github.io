export const CONTRACT_TEMPLATE_PAGE_SIZE = 10

export const DEFAULT_CONTRACT_TEMPLATE_FILTER = "all" as const
export const DEFAULT_CONTRACT_TEMPLATE_SORT = "updated_desc" as const

export const contractTemplateFilterOptions = [
  { label: "All templates", value: "all" },
  { label: "With description", value: "with_description" },
  { label: "Without description", value: "without_description" },
  { label: "Updated last 30 days", value: "updated_recent" },
] as const

export const contractTemplateSortOptions = [
  { label: "Last updated", value: "updated_desc" },
  { label: "Oldest updated", value: "updated_asc" },
  { label: "Name A-Z", value: "name_asc" },
  { label: "Name Z-A", value: "name_desc" },
] as const

export type ContractTemplateFilterValue =
  (typeof contractTemplateFilterOptions)[number]["value"]

export type ContractTemplateSortValue =
  (typeof contractTemplateSortOptions)[number]["value"]

export function normalizeContractTemplateFilterValue(
  value: string | null | undefined
): ContractTemplateFilterValue {
  const normalized = value?.trim()

  if (!normalized) {
    return DEFAULT_CONTRACT_TEMPLATE_FILTER
  }

  return contractTemplateFilterOptions.some((option) => option.value === normalized)
    ? (normalized as ContractTemplateFilterValue)
    : DEFAULT_CONTRACT_TEMPLATE_FILTER
}

export function normalizeContractTemplateSortValue(
  value: string | null | undefined
): ContractTemplateSortValue {
  const normalized = value?.trim()

  if (!normalized) {
    return DEFAULT_CONTRACT_TEMPLATE_SORT
  }

  return contractTemplateSortOptions.some((option) => option.value === normalized)
    ? (normalized as ContractTemplateSortValue)
    : DEFAULT_CONTRACT_TEMPLATE_SORT
}
