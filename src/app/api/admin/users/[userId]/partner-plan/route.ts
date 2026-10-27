import { NextResponse } from "next/server"
import { z } from "zod"

import { grantPartnerPlan, PartnerPlanError, revokePartnerPlan } from "@/features/subscriptions/server/partner-plan"
import { USER_ROLES } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

const grantSchema = z.object({ note: z.string().trim().max(200).optional().nullable() })

/** Super admins only: the partner plan is free, so not even admins may hand it out. */
async function requireSuperAdmin() {
  const session = await getAuthSession()
  if (!session?.user?.id || !session.user.email || session.user.role !== USER_ROLES.SUPER_ADMIN) return null
  return { id: session.user.id, email: session.user.email }
}

async function vendorIdOf(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorProfile: { select: { id: true } } } })
  return user?.vendorProfile?.id ?? null
}

function failure(error: unknown) {
  if (error instanceof PartnerPlanError) {
    const status = error.code === "vendor_not_found" ? 404 : error.code === "not_on_partner_plan" ? 409 : 502
    return NextResponse.json({ success: false, code: error.code, message: error.message }, { status })
  }
  console.error("Partner plan update failed", error)
  return NextResponse.json({ success: false, message: "The partner plan could not be updated." }, { status: 500 })
}

/** Grants the partner plan (Enterprise, no Stripe billing, no end date) to this vendor. */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const parsed = grantSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid note" }, { status: 400 })

  const vendorId = await vendorIdOf((await params).userId)
  if (!vendorId) return NextResponse.json({ success: false, message: "Vendor account not found" }, { status: 404 })

  try {
    const subscription = await grantPartnerPlan(vendorId, actor, parsed.data.note)
    return NextResponse.json({ success: true, status: subscription.status, planKey: subscription.planKey })
  } catch (error) {
    return failure(error)
  }
}

/** Withdraws the partner plan: the subscription ends now. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const vendorId = await vendorIdOf((await params).userId)
  if (!vendorId) return NextResponse.json({ success: false, message: "Vendor account not found" }, { status: 404 })

  try {
    const subscription = await revokePartnerPlan(vendorId, actor)
    return NextResponse.json({ success: true, status: subscription.status })
  } catch (error) {
    return failure(error)
  }
}
