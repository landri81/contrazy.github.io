import { USER_ROLES } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

export type SuperAdminActor = { id: string | null; email: string }

/**
 * The signed-in super admin, as written in audit rows and creator columns. The super admin of the environment variables
 * signs in with a session id that is no user row ("super-admin-env-user"), so the id is that of the user row with the
 * same e-mail, or null (as the other admin routes do); never the session id itself, which a foreign key refuses.
 */
export async function getSuperAdminActor(): Promise<SuperAdminActor | null> {
  const session = await getAuthSession()
  if (!session?.user?.id || !session.user.email || session.user.role !== USER_ROLES.SUPER_ADMIN) return null
  const email = session.user.email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return { id: user?.id ?? null, email }
}
