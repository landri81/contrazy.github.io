import { NextResponse } from "next/server"

import { isCardSecurityRequired } from "@/features/card-security/card-security-state"
import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

/**
 * The customer-flow transaction behind a secure-link token, with what the
 * card-security routes need, or the JSON error to return. Same refusals as the
 * payment routes: unknown link 404, cancelled link 410, no card security 409.
 */
export async function loadClientCardSecurityContext(token: string) {
  const linkContext = await getClientLinkAccessContext(token)

  if (linkContext.state === "missing") {
    return { error: NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 }) }
  }

  if (linkContext.state === "cancelled") {
    return { error: NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 }) }
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: linkContext.link.transaction.id },
    include: {
      link: true,
      vendor: true,
      clientProfile: true,
      payments: true,
      depositAuthorization: true,
      contractArtifact: true,
      cardSecurity: true,
    },
  })

  if (!transaction?.vendor?.stripeAccountId) {
    return { error: NextResponse.json({ success: false, message: "Payment configuration unavailable" }, { status: 422 }) }
  }

  if (!isCardSecurityRequired(transaction)) {
    return { error: NextResponse.json({ success: false, code: "card_security_not_required", message: "This booking does not save a card." }, { status: 409 }) }
  }

  return {
    transaction: transaction as FinanceTransaction & typeof transaction,
    stripeAccountId: transaction.vendor.stripeAccountId,
    financeStage: getNextFinanceStage(transaction),
  }
}
