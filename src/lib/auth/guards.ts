import { Prisma, type VendorProfile, type VendorStatus } from "@prisma/client"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db/prisma"
import { canAccessAdminScope, canAccessVendorScope, isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"

type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
type AuthenticatedDbUser = Prisma.UserGetPayload<{
  include: { vendorProfile: true }
}>

export async function requireAuthenticatedUser() {
  const session = await getAuthSession()

  if (!session?.user?.email || !session.user.role) {
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: { vendorProfile: true },
  })

  return { session, dbUser }
}

export async function requireVendorAccess() {
  const context = await requireAuthenticatedUser()

  if (!canAccessVendorScope(context.session.user.role)) {
    redirect("/login")
  }

  return context
}

export async function requireAdminAccess() {
  const context = await requireAuthenticatedUser()

  if (!canAccessAdminScope(context.session.user.role)) {
    redirect("/login")
  }

  return context
}

export async function requireVendorProfileAccess() {
  const context = await requireVendorAccess()

  if (!context.dbUser?.vendorProfile) {
    if (isAdminRole(context.session.user.role)) {
      redirect("/admin")
    }

    redirect("/login")
  }

  const dbUser = context.dbUser as AuthenticatedDbUser
  const vendorProfile = dbUser.vendorProfile as NonNullable<AuthenticatedDbUser["vendorProfile"]>

  return {
    session: context.session as AuthenticatedSession,
    dbUser,
    vendorProfile,
  }
}

export function isVendorApproved(vendorProfile: Pick<VendorProfile, "reviewStatus">) {
  return vendorProfile.reviewStatus === "APPROVED"
}

export function isVendorPreparationAllowed(vendorProfile: Pick<VendorProfile, "reviewStatus">) {
  return vendorProfile.reviewStatus === "PENDING" || vendorProfile.reviewStatus === "APPROVED"
}

export function getVendorStatusMessage(status: VendorStatus) {
  switch (status) {
    case "APPROVED":
      return "Your business profile is approved."
    case "PENDING":
      return "Your business profile is still under review."
    case "REJECTED":
      return "Your business profile was not approved. Update your details and contact support."
    case "SUSPENDED":
      return "Your business profile is suspended. Contact support before creating new customer flows."
    default:
      return "Your business profile status does not allow this action."
  }
}

export function ensureVendorPreparationAllowed(vendorProfile: Pick<VendorProfile, "reviewStatus">) {
  if (isVendorPreparationAllowed(vendorProfile)) {
    return null
  }

  return NextResponse.json(
    {
      success: false,
      message: getVendorStatusMessage(vendorProfile.reviewStatus),
    },
    { status: 403 }
  )
}

export function ensureVendorApproved(vendorProfile: Pick<VendorProfile, "reviewStatus">) {
  if (isVendorApproved(vendorProfile)) {
    return null
  }

  return NextResponse.json(
    {
      success: false,
      message: getVendorStatusMessage(vendorProfile.reviewStatus),
    },
    { status: 403 }
  )
}
