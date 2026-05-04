import { cache } from "react"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth/options"

export const getAuthSession = cache(function getAuthSession() {
  return getServerSession(authOptions)
})
