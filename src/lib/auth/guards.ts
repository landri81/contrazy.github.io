import { redirect } from "next/navigation"

import { prisma } from "@/lib/db/prisma"
import { canAccessAdminScope, canAccessVendorScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"

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
