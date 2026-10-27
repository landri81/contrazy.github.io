import { TransactionLinkStatus, TransactionStatus } from "@prisma/client"

import { hasSecuredCard, isCardSecurityRequired } from "@/features/card-security/card-security-state"
import {
  getClientFlowState,
  getNextClientStep,
  hasContractStep,
  hasDocumentsStep,
  type ClientFlowStep,
  type ClientFlowTransaction,
} from "@/features/client-flow/server/client-flow-data"
import type { PartnerCheckout, PartnerCheckoutNextStep, PartnerCheckoutRequirement } from "@/features/partner-api/schemas/checkout.schema"
import { isRequirementSlotSatisfied } from "@/features/transactions/contract-flow"
import type { FinanceStage } from "@/features/transactions/server/transaction-finance"

/**
 * The checkout state of a booking (embedded checkout, M10): the same steps, order and rules as Contrazy's pages
 * (`getClientFlowState`, `getNextClientStep`, `getNextFinanceStage`), named for partners and with no page path.
 */

const NEXT_STEP: Record<ClientFlowStep, PartnerCheckoutNextStep> = {
  profile: "profile",
  documents: "documents",
  kyc: "identity",
  details: "details",
  contract: "contract",
  sign: "signature",
  "check-in": "check_in",
  payment: "payment",
  complete: "complete",
  // Check-out comes after the rental, never during the checkout.
  "check-out": "complete",
}

// "none" never comes out of getNextFinanceStage today; it reads as nothing left to pay.
const PAYMENT_STAGE: Record<FinanceStage, PartnerCheckout["payment"]["stage"]> = { none: "complete", deposit_authorization: "deposit", service_payment: "rental", card_security: "card", complete: "complete" }

function slotLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((label): label is string => typeof label === "string") : []
}

function checkoutStatus(transaction: ClientFlowTransaction, financeComplete: boolean, now: Date): PartnerCheckout["status"] {
  const link = transaction.link
  if (link?.status === TransactionLinkStatus.CANCELLED || transaction.status === TransactionStatus.CANCELLED) return "cancelled"
  if (transaction.status === TransactionStatus.COMPLETED && financeComplete) return "completed"
  if (link?.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired"
  return "open"
}

function presentRequirements(transaction: ClientFlowTransaction): PartnerCheckoutRequirement[] {
  return transaction.requirements.map((requirement) => {
    const documents = transaction.documents.filter((document) => document.requirementId === requirement.id)
    return {
      id: requirement.id,
      label: requirement.label,
      instructions: requirement.instructions,
      category: requirement.category,
      required: requirement.required,
      fileCount: requirement.requiredFileCount,
      slotLabels: slotLabels(requirement.fileSlotLabels),
      files: documents.map((document) => ({
        id: document.id,
        slot: document.slotIndex,
        slotLabel: document.slotLabel,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt.toISOString(),
      })),
      complete: isRequirementSlotSatisfied(requirement, documents),
    }
  })
}

export function presentPartnerCheckout(transaction: ClientFlowTransaction, now = new Date()): PartnerCheckout {
  const state = getClientFlowState(transaction)
  const status = checkoutStatus(transaction, state.financeComplete, now)
  const contractRequired = hasContractStep(transaction)
  const paymentRequired = (transaction.amount ?? 0) > 0 || (transaction.depositAmount ?? 0) > 0
  const cardRequired = isCardSecurityRequired(transaction)
  const kycStatus = transaction.kycVerification?.status
  const next = NEXT_STEP[getNextClientStep(transaction)]
  // Contrazy's pages show the saved card inside the payment step; partners get it as its own step.
  const nextStep: PartnerCheckoutNextStep = status === "completed" ? "complete" : next === "payment" && state.nextFinanceStage === "card_security" ? "card" : next

  return {
    bookingId: transaction.id,
    status,
    nextStep,
    expiresAt: transaction.link?.expiresAt?.toISOString() ?? null,
    steps: {
      documents: { required: hasDocumentsStep(transaction) && transaction.requirements.some((requirement) => requirement.required), done: state.hasDocs },
      identity: { required: transaction.requiresKyc, done: state.hasKyc },
      contract: { required: contractRequired, done: !contractRequired || state.reviewedContract },
      signature: { required: contractRequired, done: !contractRequired || state.hasSignature },
      payment: { required: paymentRequired, done: state.nextFinanceStage === "card_security" || state.nextFinanceStage === "complete" },
      card: { required: cardRequired, done: !cardRequired || hasSecuredCard(transaction) },
    },
    requirements: presentRequirements(transaction),
    identity: {
      required: transaction.requiresKyc,
      selfie: transaction.requireSelfie,
      status: kycStatus === "VERIFIED" ? "verified" : kycStatus === "PENDING" ? "pending" : kycStatus === "FAILED" ? "failed" : "not_started",
    },
    contract: { required: contractRequired, accepted: state.reviewedContract, signed: state.hasSignature },
    payment: {
      stage: PAYMENT_STAGE[state.nextFinanceStage],
      amount: transaction.amount ?? 0,
      depositAmount: transaction.depositAmount ?? 0,
      currency: transaction.currency.toLowerCase(),
    },
  }
}
