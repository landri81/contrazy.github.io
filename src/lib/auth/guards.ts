import { cache } from "react"
import { Prisma, type VendorProfile, type VendorStatus } from "@prisma/client"
import { getLocale } from "next-intl/server"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { hasActiveSubscription } from "@/features/subscriptions/server/feature-gates"
import { getVendorSubscriptionAccessState } from "@/features/subscriptions/server/subscription-service"
import { prisma } from "@/lib/db/prisma"
import { canAccessAdminScope, canAccessVendorScope, isAdminRole } from "@/lib/auth/roles"
import { routing } from "@/i18n/routing"
import { getAuthSession } from "@/lib/auth/session"
import { withLocalePath } from "@/lib/i18n/locale-utils"

type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
type AuthenticatedDbUser = Prisma.UserGetPayload<{
  include: { vendorProfile: { include: { subscription: true } } }
}>

async function getCurrentLocalePath(path: string) {
  try {
    const locale = await getLocale()
    return withLocalePath(locale, path)
  } catch {
    return withLocalePath(routing.defaultLocale, path)
  }
}

export const requireAuthenticatedUser = cache(async function requireAuthenticatedUser() {
  const session = await getAuthSession()

  if (!session?.user?.email || !session.user.role) {
    redirect(await getCurrentLocalePath("/login"))
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: { vendorProfile: { include: { subscription: true } } },
  })

  return { session, dbUser }
})

export async function requireVendorAccess() {
  const context = await requireAuthenticatedUser()

  if (!canAccessVendorScope(context.session.user.role)) {
    redirect(await getCurrentLocalePath("/login"))
  }

  return context
}

export async function requireAdminAccess() {
  const context = await requireAuthenticatedUser()

  if (!canAccessAdminScope(context.session.user.role)) {
    redirect(await getCurrentLocalePath("/login"))
  }

  return context
}

export async function requireSuperAdminAccess() {
  const context = await requireAuthenticatedUser()

  if (context.session.user.role !== "SUPER_ADMIN") {
    redirect(await getCurrentLocalePath("/admin"))
  }

  return context
}

export const requireVendorProfileAccess = cache(async function requireVendorProfileAccess() {
  const context = await requireVendorAccess()

  if (!context.dbUser?.vendorProfile) {
    if (isAdminRole(context.session.user.role)) {
      redirect(await getCurrentLocalePath("/admin"))
    }

    redirect(await getCurrentLocalePath("/login"))
  }

  const dbUser = context.dbUser as AuthenticatedDbUser
  const vendorProfile = dbUser.vendorProfile as NonNullable<AuthenticatedDbUser["vendorProfile"]>
  const subscription = vendorProfile.subscription ?? null

  return {
    session: context.session as AuthenticatedSession,
    dbUser,
    vendorProfile,
    subscription,
  }
})

export function getVendorSubscriptionStatusMessage() {
  return "An active platform subscription is required before you can access vendor operations."
}

export const requireSubscribedVendorProfileAccess = cache(async function requireSubscribedVendorProfileAccess() {
  const context = await requireVendorProfileAccess()
  const { subscription } = context

  if (!subscription || !hasActiveSubscription(subscription)) {
    redirect(await getCurrentLocalePath("/vendor/subscribe"))
  }

  return { ...context, subscription }
})

export async function requireSubscribedVendorAccess() {
  return requireSubscribedVendorProfileAccess()
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

export async function ensureVendorSubscriptionEligible(vendorId: string) {
  const accessState = await getVendorSubscriptionAccessState(vendorId)

  if (accessState.allowed) {
    return {
      response: null,
      subscription: accessState.subscription,
    }
  }

  return {
    response: NextResponse.json(
      {
        success: false,
        code: "SUBSCRIPTION_REQUIRED",
        redirectTo: withLocalePath(routing.defaultLocale, "/vendor/subscribe"),
        message: getVendorSubscriptionStatusMessage(),
      },
      { status: 402 }
    ),
    subscription: accessState.subscription,
  }
}
