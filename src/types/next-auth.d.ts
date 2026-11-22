import type { DefaultSession } from "next-auth"
import type { JWT as DefaultJWT } from "next-auth/jwt"

import type { UserRole } from "@/lib/auth/roles"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: UserRole
    }
  }

  interface User {
    role?: UserRole
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: UserRole
    /** When the role was last read from the database (ms): it is read again every few minutes. */
    roleCheckedAt?: number
    /** The super admin's own sign-in (env credentials or Google): its role is not read from a user row. */
    superAdminSignIn?: boolean
  }
}
