import { redirect } from "next/navigation"

import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"

export default async function AuthCompletePage() {
  const session = await getAuthSession()

  redirect(getRoleHomePath(session?.user?.role))
}
