import { NextResponse } from "next/server"

import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { disputeId } = await params

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            vendor: { select: { businessName: true, businessEmail: true } },
            clientProfile: { select: { fullName: true, email: true } },
            depositAuthorization: { select: { amount: true, currency: true, status: true } },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ success: false, message: "Dispute not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, dispute })
  } catch (error) {
    console.error("Admin dispute fetch error:", error)
    return NextResponse.json({ success: false, message: "Failed to fetch dispute" }, { status: 500 })
  }
}
