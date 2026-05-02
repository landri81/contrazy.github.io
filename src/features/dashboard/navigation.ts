export type DashboardIconName =
  | "activity"
  | "badgeCheck"
  | "bookText"
  | "briefcaseBusiness"
  | "building2"
  | "creditCard"
  | "fileClock"
  | "fileText"
  | "folderKanban"
  | "layoutDashboard"
  | "link2"
  | "logs"
  | "mail"
  | "mapPinned"
  | "receiptText"
  | "scrollText"
  | "shield"
  | "signature"
  | "users"
  | "wallet"

export type DashboardNavItem = {
  href: string
  label: string
  icon: DashboardIconName
}

export type DashboardNavSection = {
  label: string
  items: DashboardNavItem[]
}

export const vendorNavigation: DashboardNavSection[] = [
  {
    label: "Cockpit",
    items: [
      { href: "/vendor", label: "Dashboard", icon: "layoutDashboard" },
      { href: "/vendor/profile", label: "Business profile", icon: "mapPinned" },
      { href: "/vendor/actions", label: "Actions", icon: "activity" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { href: "/vendor/transactions", label: "Transactions", icon: "creditCard" },
      { href: "/vendor/contracts", label: "Contract templates", icon: "scrollText" },
      { href: "/vendor/checklists", label: "Checklists", icon: "badgeCheck" },
    ],
  },
  {
    label: "Verification",
    items: [
      { href: "/vendor/kyc", label: "KYC", icon: "shield" },
      { href: "/vendor/signatures", label: "Signatures", icon: "signature" },
      { href: "/vendor/clients", label: "Clients", icon: "users" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/vendor/deposits", label: "Deposits", icon: "wallet" },
      { href: "/vendor/payments", label: "Payments", icon: "receiptText" },
      { href: "/vendor/disputes", label: "Disputes", icon: "fileClock" },
      { href: "/vendor/stripe", label: "Stripe", icon: "briefcaseBusiness" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/vendor/links", label: "Links and QR", icon: "link2" },
      { href: "/vendor/webhooks", label: "Events", icon: "logs" },
    ],
  },
]

export const adminNavigation: DashboardNavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "folderKanban" },
    ],
  },
  {
    label: "User management",
    items: [
      { href: "/admin/users", label: "All users", icon: "users" },
      { href: "/admin/vendors", label: "Vendors", icon: "building2" },
      { href: "/admin/invites", label: "Invitations", icon: "mail" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/roles", label: "Access levels", icon: "shield" },
      { href: "/admin/logs", label: "Activity logs", icon: "bookText" },
      { href: "/admin/sessions", label: "Sessions", icon: "fileText" },
    ],
  },
]
