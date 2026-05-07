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

type T = (key: string) => string

export function buildVendorNavigation(t: T): DashboardNavSection[] {
  return [
    {
      label: t("nav.vendor.sections.cockpit"),
      items: [
        { href: "/vendor", label: t("nav.vendor.items.dashboard"), icon: "layoutDashboard" },
        { href: "/vendor/profile", label: t("nav.vendor.items.businessProfile"), icon: "mapPinned" },
        { href: "/vendor/actions", label: t("nav.vendor.items.actions"), icon: "activity" },
      ],
    },
    {
      label: t("nav.vendor.sections.contractFlow"),
      items: [
        { href: "/vendor/links", label: t("nav.vendor.items.linksAndQr"), icon: "link2" },
        { href: "/vendor/transactions", label: t("nav.vendor.items.transactions"), icon: "creditCard" },
        { href: "/vendor/contracts", label: t("nav.vendor.items.contractTemplates"), icon: "scrollText" },
        { href: "/vendor/checklists", label: t("nav.vendor.items.checklists"), icon: "badgeCheck" },
      ],
    },
    {
      label: t("nav.vendor.sections.clientsVerification"),
      items: [
        { href: "/vendor/clients", label: t("nav.vendor.items.clients"), icon: "users" },
        { href: "/vendor/kyc", label: t("nav.vendor.items.kyc"), icon: "shield" },
        { href: "/vendor/signatures", label: t("nav.vendor.items.signatures"), icon: "signature" },
      ],
    },
    {
      label: t("nav.vendor.sections.finance"),
      items: [
        { href: "/vendor/deposits", label: t("nav.vendor.items.deposits"), icon: "wallet" },
        { href: "/vendor/payments", label: t("nav.vendor.items.payments"), icon: "receiptText" },
        { href: "/vendor/disputes", label: t("nav.vendor.items.disputes"), icon: "fileClock" },
      ],
    },
    {
      label: t("nav.vendor.sections.platform"),
      items: [
        { href: "/vendor/stripe", label: t("nav.vendor.items.stripe"), icon: "briefcaseBusiness" },
        { href: "/vendor/billing", label: t("nav.vendor.items.billing"), icon: "creditCard" },
        { href: "/vendor/webhooks", label: t("nav.vendor.items.events"), icon: "logs" },
      ],
    },
  ]
}

export function buildVendorSubscriptionNavigation(t: T): DashboardNavSection[] {
  return [
    {
      label: t("nav.vendor.sections.setup"),
      items: [
        { href: "/vendor/profile", label: t("nav.vendor.items.businessProfile"), icon: "mapPinned" },
        { href: "/vendor/billing", label: t("nav.vendor.items.billing"), icon: "creditCard" },
      ],
    },
  ]
}

export function buildAdminNavigation(t: T): DashboardNavSection[] {
  return [
    {
      label: t("nav.admin.sections.overview"),
      items: [
        { href: "/admin", label: t("nav.admin.items.dashboard"), icon: "folderKanban" },
      ],
    },
    {
      label: t("nav.admin.sections.userManagement"),
      items: [
        { href: "/admin/users", label: t("nav.admin.items.allUsers"), icon: "users" },
        { href: "/admin/vendors", label: t("nav.admin.items.vendors"), icon: "building2" },
        { href: "/admin/invites", label: t("nav.admin.items.invitations"), icon: "mail" },
      ],
    },
    {
      label: t("nav.admin.sections.caseManagement"),
      items: [
        { href: "/admin/disputes", label: t("nav.admin.items.disputes"), icon: "fileClock" },
      ],
    },
    {
      label: t("nav.admin.sections.platform"),
      items: [
        { href: "/admin/roles", label: t("nav.admin.items.accessLevels"), icon: "shield" },
        { href: "/admin/logs", label: t("nav.admin.items.activityLogs"), icon: "bookText" },
        { href: "/admin/sessions", label: t("nav.admin.items.sessions"), icon: "fileText" },
      ],
    },
  ]
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
    label: "Contract Flow",
    items: [
      { href: "/vendor/links", label: "Links and QR", icon: "link2" },
      { href: "/vendor/transactions", label: "Transactions", icon: "creditCard" },
      { href: "/vendor/contracts", label: "Contract templates", icon: "scrollText" },
      { href: "/vendor/checklists", label: "Checklists", icon: "badgeCheck" },
    ],
  },
  {
    label: "Clients & Verification",
    items: [
      { href: "/vendor/clients", label: "Clients", icon: "users" },
      { href: "/vendor/kyc", label: "KYC", icon: "shield" },
      { href: "/vendor/signatures", label: "Signatures", icon: "signature" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/vendor/deposits", label: "Deposits", icon: "wallet" },
      { href: "/vendor/payments", label: "Payments", icon: "receiptText" },
      { href: "/vendor/disputes", label: "Disputes", icon: "fileClock" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/vendor/stripe", label: "Stripe", icon: "briefcaseBusiness" },
      { href: "/vendor/billing", label: "Billing", icon: "creditCard" },
      { href: "/vendor/webhooks", label: "Events", icon: "logs" },
    ],
  },
]

export const vendorSubscriptionNavigation: DashboardNavSection[] = [
  {
    label: "Setup",
    items: [
      { href: "/vendor/profile", label: "Business profile", icon: "mapPinned" },
      { href: "/vendor/billing", label: "Billing", icon: "creditCard" },
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
    label: "Case management",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: "fileClock" },
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
