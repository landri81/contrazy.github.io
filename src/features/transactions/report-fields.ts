export const transactionReportFieldTypeOptions = [
  { value: "TEXT", label: "Text input" },
  { value: "NUMBER", label: "Number" },
  { value: "SELECT", label: "Select" },
  { value: "PHOTO", label: "Pictures" },
  { value: "FILE", label: "Files" },
] as const

export type TransactionReportFieldTypeValue =
  (typeof transactionReportFieldTypeOptions)[number]["value"]

export function isReportFieldScalar(
  fieldType: TransactionReportFieldTypeValue | string
) {
  return fieldType === "TEXT" || fieldType === "NUMBER" || fieldType === "SELECT"
}

export function isReportFieldUpload(
  fieldType: TransactionReportFieldTypeValue | string
) {
  return fieldType === "PHOTO" || fieldType === "FILE"
}
