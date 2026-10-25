import { NextResponse } from "next/server"
import { AuditActorType } from "@prisma/client"

import { DepositSettlementError, settleDepositHold } from "@/features/transactions/server/deposit-settlement"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

const SETTLEMENT_ERROR_STATUS: Record<DepositSettlementError["code"], number> = {
  not_found: 404,
  not_active: 400,
  missing_intent: 400,
  invalid_amount: 400,
  not_connected: 400,
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { dbUser, session, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) return blockedResponse

    const body = await request.json()
    const { action, captureAmount } = body as { action: string; captureAmount?: number }

    if (action !== "release" && action !== "capture") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, vendor: true, clientProfile: true },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction or deposit not found" }, { status: 404 })
    }

    await settleDepositHold(prisma, stripeGateway, {
      transaction,
      action,
      captureAmount,
      actor: {
        id: dbUser.id,
        type: session.user.role === "SUPER_ADMIN" ? AuditActorType.SUPER_ADMIN : AuditActorType.USER,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof DepositSettlementError) {
      return NextResponse.json({ success: false, message: error.message }, { status: SETTLEMENT_ERROR_STATUS[error.code] })
    }

    console.error("Deposit Action Error:", error)
    return NextResponse.json({ success: false, message: "Failed to process deposit action" }, { status: 500 })
  }
}
