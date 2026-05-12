import type {
  PaymentCollectionTimingValue,
  RequirementCategoryValue,
  RequirementTypeValue,
} from "@/features/transactions/contract-flow"
import type { TransactionCustomFieldTypeValue } from "@/features/transactions/custom-fields"
import type { RequirementExampleDraft } from "@/features/dashboard/lib/vendor-requirement-example-images"

export type TransactionCreationInitialRequirement = {
  label: string
  description: string
  type: RequirementTypeValue
  category: RequirementCategoryValue
  customCategoryLabel: string
  required: boolean
  exampleImage: RequirementExampleDraft | null
}

export type TransactionCreationInitialCustomField = {
  label: string
  instructions: string
  type: TransactionCustomFieldTypeValue
  selectOptions: string[]
}

export type TransactionCreationInitialValues = {
  sourceTransactionId: string
  sourceTransactionReference: string
  title: string
  notes: string
  amount: string
  depositAmount: string
  contractTemplateId: string | null
  checklistTemplateId: string | null
  requiresKyc: boolean
  generateQr: boolean
  paymentCollectionTiming: PaymentCollectionTimingValue
  requireClientCompany: boolean
  requirements: TransactionCreationInitialRequirement[]
  customFields: TransactionCreationInitialCustomField[]
  missingContractTemplateName: string | null
}
