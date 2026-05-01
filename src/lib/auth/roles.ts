export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  VENDOR: "VENDOR",
  CLIENT: "CLIENT",
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export function isAdminRole(role: UserRole | null | undefined) {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN
}

export function canAccessVendorScope(role: UserRole | null | undefined) {
  return role === USER_ROLES.VENDOR || isAdminRole(role)
}

export function canAccessAdminScope(role: UserRole | null | undefined) {
  return isAdminRole(role)
}

export function isSuperAdminEmail(email: string | null | undefined, superAdminEmail: string) {
  if (!email) {
    return false
  }

  return email.trim().toLowerCase() === superAdminEmail.trim().toLowerCase()
}
