import type { UserRole } from "@/lib/auth/roles"
import { USER_ROLES } from "@/lib/auth/roles"

export function getRoleHomePath(role: UserRole | null | undefined) {
  if (role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN) {
    return "/admin"
  }

  if (role === USER_ROLES.VENDOR) {
    return "/vendor"
  }

  return "/login"
}
