import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/prisma"

// Get valid transaction data by secure token
export async function getTransactionByToken(token: string) {
  const link = await prisma.transactionLink.findUnique({
    where: { token },
    include: {
      transaction: {
        include: {
          vendor: true,
          clientProfile: true,
          requirements: true,
          documents: true,
          kycVerification: true,
          signatureRecord: true,
          payments: true,
          depositAuthorization: true,
          contractTemplate: true,
        }
      }
    }
  })

  if (!link || !link.transaction) {
    return null
  }

  // Update openedAt tracking if not set
  if (!link.openedAt) {
    await prisma.transactionLink.update({
      where: { id: link.id },
      data: { openedAt: new Date() }
    })
  }

  return link.transaction
}

// Ensure client flow isn't bypassed for required steps
export function validateClientStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction: any, 
  currentStep: 'profile' | 'documents' | 'kyc' | 'contract' | 'sign' | 'payment' | 'complete'
) {
  // If completed, only allow complete step
  if (transaction.status === 'COMPLETED' && currentStep !== 'complete') {
    redirect(`/t/${transaction.link.token}/complete`)
  }

  const hasProfile = !!transaction.clientProfileId
  const hasKyc = !transaction.requiresKyc || transaction.kycVerification?.status === 'VERIFIED'
  const hasDocs = transaction.requirements.length === 0 || 
    (transaction.documents.length >= transaction.requirements.filter((r: { required: boolean }) => r.required).length)
  const hasSignature = !transaction.contractTemplateId || transaction.signatureRecord?.status === 'SIGNED'

  // Step gatekeeping logic
  if (currentStep === 'documents' && !hasProfile) redirect(`/t/${transaction.link.token}/profile`)
  if (currentStep === 'kyc' && (!hasProfile || !hasDocs)) {
    if (!hasDocs) redirect(`/t/${transaction.link.token}/documents`)
    redirect(`/t/${transaction.link.token}/profile`)
  }
  if (currentStep === 'contract' && (!hasProfile || !hasDocs || !hasKyc)) {
    if (!hasKyc) redirect(`/t/${transaction.link.token}/kyc`)
    if (!hasDocs) redirect(`/t/${transaction.link.token}/documents`)
    redirect(`/t/${transaction.link.token}/profile`)
  }
  if (currentStep === 'sign' && (!hasProfile || !hasDocs || !hasKyc)) {
    redirect(`/t/${transaction.link.token}/contract`)
  }
  if (currentStep === 'payment' && (!hasProfile || !hasDocs || !hasKyc || !hasSignature)) {
    if (!hasSignature) redirect(`/t/${transaction.link.token}/sign`)
    redirect(`/t/${transaction.link.token}/contract`)
  }
  
  return { hasProfile, hasDocs, hasKyc, hasSignature }
}
