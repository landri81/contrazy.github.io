export const transactionCustomFieldTypeOptions = [
  { value: "TEXT", label: "Text input" },
  { value: "NUMBER", label: "Number" },
  { value: "SELECT", label: "Select" },
] as const

export type TransactionCustomFieldTypeValue =
  (typeof transactionCustomFieldTypeOptions)[number]["value"]

export type TransactionCustomFieldRenderEntry = {
  label: string
  value: string
}

export function parseTransactionCustomFieldSelectOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((option) =>
    typeof option === "string" && option.trim().length > 0 ? [option.trim()] : []
  )
}

export function buildTransactionCustomFieldRenderEntries(
  fields: Array<{
    label: string
    response?: {
      value: string | null
    } | null
  }>
) {
  return fields.flatMap((field) => {
    const value = field.response?.value?.trim()

    if (!value) {
      return []
    }

    return [{ label: field.label, value }] satisfies TransactionCustomFieldRenderEntry[]
  })
}

export function hasCompletedTransactionCustomFields(
  fields: Array<{
    response?: {
      value: string | null
    } | null
  }>
) {
  if (fields.length === 0) {
    return true
  }

  return fields.every((field) => Boolean(field.response?.value?.trim()))
}
