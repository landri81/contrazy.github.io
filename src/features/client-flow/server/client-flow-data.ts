import { Prisma, SignatureStatus, TransactionLinkActor, TransactionLinkStatus, TransactionStatus } from "@prisma/client"
import { redirect } from "next/navigation"

import {
  localizeCustomerDetailsSectionHeading,
  renderContractContent,
} from "@/features/contracts/server/contract-rendering"
import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import {
  buildTransactionCustomFieldRenderEntries,
  hasCompletedTransactionCustomFields,
} from "@/features/transactions/custom-fields"
import {
  cancelTransactionLink,
  isCancellableLinkStatus,
  markTransactionLinkOpened,
} from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

const reviewedContractStatuses = new Set<TransactionStatus>([
  TransactionStatus.CONTRACT_GENERATED,
  TransactionStatus.SIGNED,
  TransactionStatus.PAYMENT_AUTHORIZED,
  TransactionStatus.COMPLETED,
])

export const clientFlowSteps = [
  { key: "profile", label: "Profile" },
  { key: "kyc", label: "Identity" },
  { key: "documents", label: "Documents" },
  { key: "details", label: "Details" },
  { key: "contract", label: "Agreement" },
  { key: "sign", label: "Signature" },
  { key: "payment", label: "Payment" },
  { key: "complete", label: "Complete" },
] as const

export type ClientFlowStep = (typeof clientFlowSteps)[number]["key"]

const editableClientFlowSteps = new Set<ClientFlowStep>([
  "profile",
  "documents",
  "kyc",
  "details",
  "contract",
  "sign",
])

const clientFinanceLockEventTypes = new Set([
  "PAYMENT_SESSION_CREATED",
  "SERVICE_PAYMENT_REQUESTED",
  "SERVICE_PAYMENT_SUCCEEDED",
  "DEPOSIT_AUTHORIZED",
  "DEPOSIT_CAPTURED",
  "DEPOSIT_RELEASED",
])

export const clientFlowTransactionInclude = {
  link: true,
  vendor: true,
  clientProfile: true,
  requirements: {
    orderBy: { sortOrder: "asc" },
  },
  customFields: {
    orderBy: { sortOrder: "asc" },
    include: {
      response: true,
    },
  },
  documents: {
    orderBy: { uploadedAt: "asc" },
  },
  kycVerification: true,
  signatureRecord: true,
  payments: true,
  depositAuthorization: true,
  contractTemplate: true,
  contractArtifact: true,
  events: {
    orderBy: { occurredAt: "asc" },
  },
} satisfies Prisma.TransactionInclude

export type ClientFlowTransaction = Prisma.TransactionGetPayload<{
  include: typeof clientFlowTransactionInclude
}>

export function hasContractStep(transaction: Pick<ClientFlowTransaction, "contractTemplateId" | "contractTemplate" | "contractArtifact">) {
  return Boolean(
    transaction.contractArtifact?.templateContentSnapshot ||
      transaction.contractTemplateId ||
      transaction.contractTemplate
  )
}

function getClientRoute(transaction: ClientFlowTransaction, step: ClientFlowStep) {
  const locale = normalizeLocale(transaction.locale)
  return withLocalePath(locale, `/t/${transaction.link?.token}/${step}`)
}

export async function getTransactionByToken(token: string): Promise<ClientFlowTransaction | null> {
  let transaction = await prisma.transaction.findFirst({
    where: {
      link: {
        is: { token },
      },
    },
    include: clientFlowTransactionInclude,
  })

  if (!transaction?.link) {
    return null
  }

  if (
    transaction.link.expiresAt &&
    transaction.link.expiresAt.getTime() <= Date.now() &&
    transaction.link.status !== TransactionLinkStatus.CANCELLED &&
    transaction.link.status !== TransactionLinkStatus.COMPLETED
  ) {
    await cancelTransactionLink(prisma, {
      linkId: transaction.link.id,
      actor: TransactionLinkActor.SYSTEM,
      reason: "The secure link expired.",
      detail: "The secure link expired before the customer completed the flow.",
      title: "Secure link expired",
    })

    transaction = await prisma.transaction.findFirst({
      where: {
        link: {
          is: { token },
        },
      },
      include: clientFlowTransactionInclude,
    })

    if (!transaction?.link) {
      return null
    }
  }

  if (transaction.link.status === TransactionLinkStatus.CANCELLED) {
    return transaction
  }

  if (!transaction.link.openedAt) {
    const openedAt = new Date()

    await prisma.$transaction(async (tx) => {
      await markTransactionLinkOpened(tx, {
        linkId: transaction!.link!.id,
        transactionId: transaction!.id,
        occurredAt: openedAt,
      })
    })

    transaction.link.openedAt = openedAt
    transaction.link.status = TransactionLinkStatus.PROCESSING
  }

  return transaction
}

export function hasRequiredDocuments(transaction: ClientFlowTransaction) {
  const requiredRequirements = transaction.requirements.filter((requirement) => requirement.required)

  if (requiredRequirements.length === 0) {
    return true
  }

  return requiredRequirements.every((requirement) =>
    transaction.documents.some(
      (document) =>
        (document.requirementId === requirement.id ||
          document.label.trim().toLowerCase() === requirement.label.trim().toLowerCase()) &&
        (requirement.type === "TEXT" ? Boolean(document.textValue?.trim()) : Boolean(document.assetUrl))
    )
  )
}

export function hasReviewedContract(transaction: ClientFlowTransaction) {
  if (!hasContractStep(transaction)) {
    return true
  }

  if (transaction.contractArtifact) {
    return Boolean(
      transaction.contractArtifact.reviewCompletedAt ||
        transaction.contractArtifact.signedPdfUrl
    )
  }

  return (
    reviewedContractStatuses.has(transaction.status) ||
    transaction.events.some((event) => event.type === "CONTRACT_REVIEWED")
  )
}

export function hasCustomFieldStep(transaction: Pick<ClientFlowTransaction, "customFields">) {
  return transaction.customFields.length > 0
}

export function hasCompletedSignature(transaction: ClientFlowTransaction) {
  if (!hasContractStep(transaction)) {
    return true
  }

  return (
    transaction.signatureRecord?.status === SignatureStatus.SIGNED &&
    Boolean(transaction.contractArtifact?.signedPdfUrl)
  )
}

export function getClientFlowState(transaction: ClientFlowTransaction) {
  const hasProfile = Boolean(transaction.clientProfileId && transaction.clientProfile)
  const hasDocs = hasRequiredDocuments(transaction)
  // PENDING means an identity check was started and the client may proceed while verification completes or awaits review.
  const hasKyc =
    !transaction.requiresKyc ||
    transaction.kycVerification?.status === "VERIFIED" ||
    transaction.kycVerification?.status === "PENDING"
  const hasCustomFields = hasCompletedTransactionCustomFields(transaction.customFields)
  const reviewedContract = hasReviewedContract(transaction)
  const hasSignature = hasCompletedSignature(transaction)
  const nextFinanceStage = getNextFinanceStage(transaction as FinanceTransaction)
  const financeComplete = nextFinanceStage === "complete"

  return {
    hasProfile,
    hasDocs,
    hasKyc,
    hasCustomFields,
    reviewedContract,
    hasSignature,
    nextFinanceStage,
    financeComplete,
  }
}

export function hasStartedClientFinance(
  transaction: Pick<
    ClientFlowTransaction,
    "payments" | "depositAuthorization" | "events" | "servicePaymentRequestedAt"
  >
) {
  return Boolean(
    transaction.servicePaymentRequestedAt ||
      transaction.payments.length > 0 ||
      transaction.depositAuthorization ||
      transaction.events.some((event) => clientFinanceLockEventTypes.has(event.type))
  )
}

export function canRevisitClientStep(
  transaction: Pick<
    ClientFlowTransaction,
    "payments" | "depositAuthorization" | "events" | "servicePaymentRequestedAt"
  >,
  step: ClientFlowStep
) {
  return editableClientFlowSteps.has(step) && !hasStartedClientFinance(transaction)
}

function getClientEditLockRedirectStep(transaction: ClientFlowTransaction): ClientFlowStep {
  return getClientFlowState(transaction).financeComplete ? "complete" : "payment"
}

export function getNextClientStep(transaction: ClientFlowTransaction): ClientFlowStep {
  const state = getClientFlowState(transaction)

  if (transaction.status === TransactionStatus.COMPLETED && state.financeComplete) {
    return "complete"
  }

  if (!state.hasProfile) {
    return "profile"
  }

  if (!state.hasDocs) {
    return "documents"
  }

  if (!state.hasKyc) {
    return "kyc"
  }

  if (hasCustomFieldStep(transaction) && !state.hasCustomFields) {
    return "details"
  }

  if (hasContractStep(transaction) && !state.reviewedContract) {
    return "contract"
  }

  if (hasContractStep(transaction) && !state.hasSignature) {
    return "sign"
  }

  if (!state.financeComplete) {
    return "payment"
  }

  return "complete"
}

export function canCancelClientFlow(transaction: ClientFlowTransaction) {
  if (!transaction.link || !isCancellableLinkStatus(transaction.link.status)) {
    return false
  }

  return getNextClientStep(transaction) !== "complete"
}

export function buildPopulatedContractContent(transaction: ClientFlowTransaction) {
  const templateContent =
    transaction.contractArtifact?.templateContentSnapshot ??
    transaction.contractTemplate?.content

  if (!templateContent) {
    return ""
  }

  return (
    transaction.contractArtifact?.renderedContentBeforeSignature
      ? localizeCustomerDetailsSectionHeading(
          transaction.contractArtifact.renderedContentBeforeSignature,
          transaction.locale
        )
      : renderContractContent({
          templateContent,
          clientProfile: transaction.clientProfile,
          vendorName: transaction.vendor?.businessName,
          transactionReference: transaction.reference,
          amount: transaction.amount,
          depositAmount: transaction.depositAmount,
          locale: transaction.locale,
          customerDetails: buildTransactionCustomFieldRenderEntries(transaction.customFields),
        })
  )
}

export function validateClientStep(transaction: ClientFlowTransaction, currentStep: ClientFlowStep) {
  const state = getClientFlowState(transaction)
  const nextStep = getNextClientStep(transaction)

  if (!transaction.link) {
    redirect(withLocalePath("en", "/"))
  }

  if (transaction.link.status === TransactionLinkStatus.CANCELLED) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${transaction.link.token}/cancelled`))
  }

  if (transaction.status === TransactionStatus.COMPLETED && currentStep !== "complete") {
    redirect(getClientRoute(transaction, "complete"))
  }

  if (editableClientFlowSteps.has(currentStep) && hasStartedClientFinance(transaction)) {
    redirect(getClientRoute(transaction, getClientEditLockRedirectStep(transaction)))
  }

  switch (currentStep) {
    case "profile":
      return state
    case "documents":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      return state
    case "kyc":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      if (!state.hasDocs) {
        redirect(getClientRoute(transaction, "documents"))
      }
      if (!transaction.requiresKyc) {
        redirect(getClientRoute(transaction, nextStep))
      }
      return state
    case "contract":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      if (!state.hasDocs) {
        redirect(getClientRoute(transaction, "documents"))
      }
      if (!state.hasKyc) {
        redirect(getClientRoute(transaction, "kyc"))
      }
      if (hasCustomFieldStep(transaction) && !state.hasCustomFields) {
        redirect(getClientRoute(transaction, "details"))
      }
      if (!hasContractStep(transaction)) {
        redirect(getClientRoute(transaction, nextStep))
      }
      return state
    case "details":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      if (!state.hasDocs) {
        redirect(getClientRoute(transaction, "documents"))
      }
      if (!state.hasKyc) {
        redirect(getClientRoute(transaction, "kyc"))
      }
      if (!hasCustomFieldStep(transaction)) {
        redirect(getClientRoute(transaction, nextStep))
      }
      return state
    case "sign":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      if (!state.hasDocs) {
        redirect(getClientRoute(transaction, "documents"))
      }
      if (!state.hasKyc) {
        redirect(getClientRoute(transaction, "kyc"))
      }
      if (hasCustomFieldStep(transaction) && !state.hasCustomFields) {
        redirect(getClientRoute(transaction, "details"))
      }
      if (!hasContractStep(transaction)) {
        redirect(getClientRoute(transaction, nextStep))
      }
      if (!state.reviewedContract) {
        redirect(getClientRoute(transaction, "contract"))
      }
      return state
    case "payment":
      if (!state.hasProfile) {
        redirect(getClientRoute(transaction, "profile"))
      }
      if (!state.hasDocs) {
        redirect(getClientRoute(transaction, "documents"))
      }
      if (!state.hasKyc) {
        redirect(getClientRoute(transaction, "kyc"))
      }
      if (hasCustomFieldStep(transaction) && !state.hasCustomFields) {
        redirect(getClientRoute(transaction, "details"))
      }
      if (hasContractStep(transaction) && !state.reviewedContract) {
        redirect(getClientRoute(transaction, "contract"))
      }
      if (hasContractStep(transaction) && !state.hasSignature) {
        redirect(getClientRoute(transaction, "sign"))
      }
      if (state.financeComplete) {
        redirect(getClientRoute(transaction, "complete"))
      }
      return state
    case "complete":
      if (nextStep !== "complete") {
        redirect(getClientRoute(transaction, nextStep))
      }
      return state
    default:
      return state
  }
}
