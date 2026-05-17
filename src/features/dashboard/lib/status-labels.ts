const dashboardStatusLabelKeys = {
  ACTIVE: "active",
  TRIALING: "trialing",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  CONNECTED: "connected",
  NOT_CONNECTED: "notConnected",
  MISSING: "missing",
  OPTIONAL: "optional",
  REQUIRED: "required",
  INCOMPLETE: "incomplete",
  INCOMPLETE_EXPIRED: "expired",
  CANCELED: "canceled",
  ATTACHED: "attached",
  SIGNED: "signed",
} as const

export type DashboardStatusLabelKey =
  (typeof dashboardStatusLabelKeys)[keyof typeof dashboardStatusLabelKeys]

export function getDashboardStatusLabelKey(value: string) {
  const normalized = value.trim().replaceAll(" ", "_").toUpperCase()
  return dashboardStatusLabelKeys[normalized as keyof typeof dashboardStatusLabelKeys] ?? null
}

export function humanizeStatusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
