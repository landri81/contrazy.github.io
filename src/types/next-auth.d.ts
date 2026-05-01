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
  }
}
