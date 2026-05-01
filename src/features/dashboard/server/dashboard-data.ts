import { nanoid } from "nanoid"

import { prisma } from "@/lib/db/prisma"

export const DEMO_TRANSACTION_ID = "ctz-0412"

export type SummaryKpi = {
  label: string
  value: string
  detail?: string
  tone?: "success" | "warning" | "danger" | "neutral" | "info"
}

export type AlertRecord = {
  title: string
  description: string
  tone: "success" | "warning" | "danger" | "neutral" | "info"
  href?: string
  hrefLabel?: string
}

export type TransactionRecord = {
  id: string
  reference: string
  clientName: string
  clientEmail: string
  kind: string
  amount: string
  kyc: string
  contract: string
  status: string
  date: string
}

export type WorkspaceRecord = {
  summary: {
    fullName: string
    businessName: string
    businessEmail: string
    supportEmail: string
    businessPhone: string
    businessAddress: string
    businessCountry: string
    reviewStatus: string
    stripeConnectionStatus: string
    profileCompletion: number
  }
  alerts: AlertRecord[]
  kpis: SummaryKpi[]
  actionItems: {
    priority: string
    action: string
    client: string
    reference: string
    due: string
  }[]
  transactions: TransactionRecord[]
  contractTemplates: { title: string; description: string; tag?: string; meta?: string }[]
  checklistTemplates: { title: string; description: string; tag?: string; meta?: string }[]
  kycCases: { client: string; reference: string; status: string; provider: string; note: string }[]
  signatures: { signer: string; reference: string; status: string; template: string; date: string }[]
  deposits: { client: string; reference: string; amount: string; status: string; date: string }[]
  payments: { client: string; reference: string; amount: string; status: string; date: string }[]
  disputes: { client: string; reference: string; status: string; summary: string }[]
  clients: { name: string; email: string; status: string; lastTransaction: string }[]
  links: { reference: string; token: string; shortCode: string; state: string }[]
  webhooks: { provider: string; eventType: string; status: string; date: string }[]
}

export type TransactionDetailRecord = {
  reference: string
  title: string
  summaryLine: string
  facts: { label: string; value: string }[]
  timeline: { title: string; detail: string; pending?: boolean }[]
}

export type AdminWorkspaceRecord = {
  kpis: SummaryKpi[]
  vendors: { id: string; userId: string; businessName: string; businessEmail: string; reviewStatus: string; stripeConnectionStatus: string }[]
  users: { id: string; name: string; email: string; role: string; company: string; status: string }[]
  invites: { id: string; email: string; role: string; status: string; expiresAt: string }[]
  rolePolicies: { title: string; description: string; tag?: string; meta?: string }[]
  logs: { actor: string; action: string; entity: string; date: string }[]
  sessions: { user: string; role: string; state: string; lastSeen: string }[]
}

export type AdminUserDetailRecord = {
  id: string
  name: string
  email: string
  role: string
  company: string
  status: string
  vendorProfile: null | {
    businessName: string
    businessEmail: string
    supportEmail: string
    businessPhone: string
    businessAddress: string
    businessCountry: string
    reviewStatus: string
    stripeConnectionStatus: string
    profileCompletion: number
  }
}

const demoTransactionDetail: TransactionDetailRecord = {
  reference: "CTZ-0412",
  title: "Transaction detail",
  summaryLine: "Marie Dupont · Deposit · EUR 800",
  facts: [
    { label: "Client", value: "Marie Dupont" },
    { label: "Type", value: "Deposit authorization" },
    { label: "Amount", value: "EUR 800.00" },
    { label: "Global status", value: "Secured" },
    { label: "KYC", value: "3 of 3 verified" },
    { label: "Contract", value: "Signed" },
    { label: "Contract template", value: "Vehicle rental agreement v3" },
    { label: "Capture window", value: "Apr 17, 18:00" },
    { label: "Stripe reference", value: "pi_3QfK_demo_x7Yz" },
  ],
  timeline: [
    { title: "Link sent by SMS", detail: "Apr 10, 09:14 · +33 6 00 00 42" },
    { title: "Client opened the link", detail: "Apr 10, 09:31 · iPhone · Nice, FR" },
    { title: "Profile completed", detail: "Apr 10, 09:33" },
    { title: "Identity document verified", detail: "Apr 10, 09:35 · Stripe Identity" },
    { title: "Driver license verified", detail: "Apr 10, 09:36" },
    { title: "Selfie match verified", detail: "Apr 10, 09:37" },
    { title: "Contract generated", detail: "Apr 10, 09:37 · 3 pages" },
    { title: "Signature completed", detail: "Apr 10, 09:39 · Built-in OTP" },
    { title: "Deposit authorized", detail: "Apr 10, 09:41 · Visa ending 4242" },
    { title: "Waiting for release or capture", detail: "Expires Apr 17, 18:00", pending: true },
  ],
}

const demoAdminWorkspace: AdminWorkspaceRecord = {
  kpis: [
    { label: "Vendors", value: "95", detail: "Across the current sample", tone: "neutral" },
    { label: "Pending reviews", value: "8", detail: "Need admin action", tone: "warning" },
    { label: "Connected Stripe accounts", value: "62", detail: "Operational", tone: "success" },
    { label: "Webhook alerts", value: "3", detail: "Needs inspection", tone: "danger" },
  ],
  vendors: [
    { id: "vendor-locaz", userId: "user-vendor-aziz", businessName: "LOCAZ SARL", businessEmail: "operations@locaz.example", reviewStatus: "APPROVED", stripeConnectionStatus: "CONNECTED" },
    { id: "vendor-hotel", userId: "user-vendor-azure", businessName: "Azure Stay", businessEmail: "ops@azurestay.example", reviewStatus: "PENDING", stripeConnectionStatus: "PENDING" },
    { id: "vendor-service", userId: "user-vendor-flow", businessName: "Flow Services", businessEmail: "team@flowservices.example", reviewStatus: "APPROVED", stripeConnectionStatus: "CONNECTED" },
  ],
  users: [
    { id: "user-vendor-aziz", name: "Aziz Landri", email: "aziz@locaz.example", role: "VENDOR", company: "LOCAZ SARL", status: "Approved" },
    { id: "user-admin-julia", name: "Julia Laurent", email: "julia@conntrazy.example", role: "ADMIN", company: "Conntrazy", status: "Active" },
    { id: "user-client-marie", name: "Marie Dupont", email: "marie@gmail.com", role: "CLIENT", company: "Independent", status: "Active" },
  ],
  invites: [
    { id: nanoid(), email: "ops@azurestay.example", role: "VENDOR", status: "Pending", expiresAt: "May 7, 2026" },
    { id: nanoid(), email: "admin@conntrazy.example", role: "ADMIN", status: "Accepted", expiresAt: "Completed" },
  ],
  rolePolicies: [
    {
      title: "SUPER_ADMIN",
      description: "Reserved access for the account owner to manage platform-wide decisions and sensitive actions.",
      tag: "Privileged",
    },
    {
      title: "ADMIN",
      description: "Internal team access for vendor review, invitations, activity checks, and day-to-day platform management.",
      tag: "Staff",
    },
    {
      title: "VENDOR",
      description: "Workspace access for business setup, customer journeys, agreements, payments, and deposits.",
      tag: "Workspace",
    },
    {
      title: "CLIENT",
      description: "Optional account access for future use, while most customer journeys continue from a secure link.",
      tag: "Optional",
    },
  ],
  logs: [
    { actor: "Julia Laurent", action: "Approved vendor", entity: "LOCAZ SARL", date: "Apr 17, 09:10" },
    { actor: "System", action: "Processed webhook", entity: "payment_intent.succeeded", date: "Apr 16, 11:22" },
    { actor: "Aziz Landri", action: "Created transaction", entity: "CTZ-0412", date: "Apr 10, 09:14" },
  ],
  sessions: [
    { user: "Julia Laurent", role: "ADMIN", state: "Active", lastSeen: "2 min ago" },
    { user: "Aziz Landri", role: "VENDOR", state: "Active", lastSeen: "8 min ago" },
    { user: "Env Super Admin", role: "SUPER_ADMIN", state: "Active", lastSeen: "14 min ago" },
  ],
}

function formatMoney(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) {
    return "Not set"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function getFilledCount(values: Array<string | null | undefined>) {
  return values.filter((value) => Boolean(value?.trim())).length
}

function getProfileCompletion(profile: {
  businessName?: string | null
  businessEmail?: string | null
  supportEmail?: string | null
  businessPhone?: string | null
  businessAddress?: string | null
  businessCountry?: string | null
}) {
  const total = 6
  const filled = getFilledCount([
    profile.businessName,
    profile.businessEmail,
    profile.supportEmail,
    profile.businessPhone,
    profile.businessAddress,
    profile.businessCountry,
  ])

  return Math.round((filled / total) * 100)
}

function buildVendorSummary(user: {
  name: string | null
  email: string
  vendorProfile: {
    businessName: string | null
    businessEmail: string | null
    supportEmail: string | null
    businessPhone: string | null
    businessAddress: string | null
    businessCountry: string | null
    reviewStatus: string
    stripeConnectionStatus: string
  }
}) {
  return {
    fullName: user.name ?? "Account owner",
    businessName: user.vendorProfile.businessName ?? "Your business",
    businessEmail: user.vendorProfile.businessEmail ?? user.email,
    supportEmail: user.vendorProfile.supportEmail ?? "Not set",
    businessPhone: user.vendorProfile.businessPhone ?? "Not set",
    businessAddress: user.vendorProfile.businessAddress ?? "Not set",
    businessCountry: user.vendorProfile.businessCountry ?? "Not set",
    reviewStatus: user.vendorProfile.reviewStatus,
    stripeConnectionStatus: user.vendorProfile.stripeConnectionStatus,
    profileCompletion: getProfileCompletion(user.vendorProfile),
  }
}

function buildVendorAlerts(summary: WorkspaceRecord["summary"]): AlertRecord[] {
  const alerts: AlertRecord[] = []

  if (summary.profileCompletion < 100) {
    alerts.push({
      title: "Complete your business profile",
      description: "Finish your business details so the review team can approve the account without delay.",
      tone: "warning",
      href: "/vendor/profile",
      hrefLabel: "Open profile",
    })
  }

  if (summary.reviewStatus === "PENDING") {
    alerts.push({
      title: "Your account is under review",
      description: "You can complete your setup now. Access to live operations will follow once the review is approved.",
      tone: "info",
    })
  }

  if (summary.stripeConnectionStatus === "NOT_CONNECTED" || summary.stripeConnectionStatus === "PENDING") {
    alerts.push({
      title: "Payout setup is still incomplete",
      description: "Connect your payout account so future customer payments and deposit holds can be activated.",
      tone: "neutral",
      href: "/vendor/stripe",
      hrefLabel: "Review payouts",
    })
  }

  return alerts
}

function buildVendorKpis(args: {
  transactionCount: number
  clientCount: number
  reviewStatus: string
  stripeConnectionStatus: string
  profileCompletion: number
}) {
  return [
    { label: "Business profile", value: `${args.profileCompletion}%`, detail: "Setup progress", tone: "info" as const },
    { label: "Review status", value: args.reviewStatus.replaceAll("_", " "), detail: "Account review", tone: mapToneFromStatus(args.reviewStatus) },
    { label: "Payout setup", value: args.stripeConnectionStatus.replaceAll("_", " "), detail: "Payment readiness", tone: mapToneFromStatus(args.stripeConnectionStatus) },
    { label: "Customers tracked", value: `${args.clientCount}`, detail: args.transactionCount > 0 ? `${args.transactionCount} active workflows` : "No workflows yet", tone: "neutral" as const },
  ]
}

function buildVendorActionItems(summary: WorkspaceRecord["summary"]): WorkspaceRecord["actionItems"] {
  const items: WorkspaceRecord["actionItems"] = []

  if (summary.profileCompletion < 100) {
    items.push({
      priority: "Important",
      action: "Complete the business profile",
      client: "Account setup",
      reference: "PROFILE",
      due: "Today",
    })
  }

  if (summary.reviewStatus === "PENDING") {
    items.push({
      priority: "Important",
      action: "Check business details before review completes",
      client: "Account setup",
      reference: "REVIEW",
      due: "Before approval",
    })
  }

  if (summary.reviewStatus === "REJECTED" || summary.reviewStatus === "SUSPENDED") {
    items.push({
      priority: "Urgent",
      action: "Resolve the account review issue",
      client: "Account setup",
      reference: "SUPPORT",
      due: "As soon as possible",
    })
  }

  if (summary.stripeConnectionStatus === "NOT_CONNECTED" || summary.stripeConnectionStatus === "PENDING") {
    items.push({
      priority: "Important",
      action: "Finish payout setup",
      client: "Finance",
      reference: "PAYOUTS",
      due: "Before going live",
    })
  }

  if (items.length === 0) {
    items.push({
      priority: "Normal",
      action: "Create your first customer workflow",
      client: "Business growth",
      reference: "WORKFLOW",
      due: "When ready",
    })
  }

  return items
}

function createEmptyVendorWorkspace(summary: WorkspaceRecord["summary"]): WorkspaceRecord {
  return {
    summary,
    alerts: buildVendorAlerts(summary),
    kpis: buildVendorKpis({
      transactionCount: 0,
      clientCount: 0,
      reviewStatus: summary.reviewStatus,
      stripeConnectionStatus: summary.stripeConnectionStatus,
      profileCompletion: summary.profileCompletion,
    }),
    actionItems: buildVendorActionItems(summary),
    transactions: [],
    contractTemplates: [],
    checklistTemplates: [],
    kycCases: [],
    signatures: [],
    deposits: [],
    payments: [],
    disputes: [],
    clients: [],
    links: [],
    webhooks: [],
  }
}

function createEmptyAdminWorkspace(): AdminWorkspaceRecord {
  return {
    kpis: [
      { label: "Vendors", value: "0", detail: "No vendor accounts yet", tone: "neutral" },
      { label: "Pending reviews", value: "0", detail: "Nothing waiting", tone: "neutral" },
      { label: "Connected payouts", value: "0", detail: "No connected accounts", tone: "neutral" },
      { label: "Open alerts", value: "0", detail: "No recent issues", tone: "neutral" },
    ],
    vendors: [],
    users: [],
    invites: [],
    rolePolicies: demoAdminWorkspace.rolePolicies,
    logs: [],
    sessions: [],
  }
}

function mapToneFromStatus(status: string): AlertRecord["tone"] {
  const normalized = status.toLowerCase()

  if (normalized.includes("not_connected") || normalized.includes("not connected")) {
    return "warning"
  }

  if (normalized.includes("fail") || normalized.includes("reject") || normalized.includes("open")) {
    return "danger"
  }

  if (normalized.includes("pending") || normalized.includes("wait")) {
    return "warning"
  }

  if (
    normalized.includes("connect") ||
    normalized.includes("verify") ||
    normalized.includes("success") ||
    normalized.includes("approve") ||
    normalized.includes("signed") ||
    normalized.includes("complete") ||
    normalized.includes("active") ||
    normalized.includes("processed")
  ) {
    return "success"
  }

  return "neutral"
}

async function safeQuery<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query()
  } catch (error) {
    console.error("Dashboard data query failed", error)
    return fallback
  }
}

export async function getVendorWorkspace(email: string | undefined | null): Promise<WorkspaceRecord> {
  if (!email) {
    return createEmptyVendorWorkspace({
      fullName: "Account owner",
      businessName: "Your business",
      businessEmail: "Not set",
      supportEmail: "Not set",
      businessPhone: "Not set",
      businessAddress: "Not set",
      businessCountry: "Not set",
      reviewStatus: "PENDING",
      stripeConnectionStatus: "NOT_CONNECTED",
      profileCompletion: 0,
    })
  }

  const user = await safeQuery(
    () =>
      prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { vendorProfile: true },
      }),
    null
  )

  if (!user?.vendorProfile) {
    return createEmptyVendorWorkspace({
      fullName: user?.name ?? "Account owner",
      businessName: "Your business",
      businessEmail: user?.email ?? "Not set",
      supportEmail: "Not set",
      businessPhone: "Not set",
      businessAddress: "Not set",
      businessCountry: "Not set",
      reviewStatus: "PENDING",
      stripeConnectionStatus: "NOT_CONNECTED",
      profileCompletion: 0,
    })
  }

  const vendorProfile = user.vendorProfile
  const summary = buildVendorSummary({
    name: user.name,
    email: user.email,
    vendorProfile,
  })

  const vendorId = vendorProfile.id

  const [transactions, contracts, checklists, webhooks, clients] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where: { vendorId },
          include: { clientProfile: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.contractTemplate.findMany({
          where: { vendorId },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.checklistTemplate.findMany({
          where: { vendorId },
          include: { items: true },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.webhookEvent.findMany({
          where: { vendorId },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.clientProfile.findMany({
          where: { vendorId },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
      []
    ),
  ])

  if (transactions.length === 0 && contracts.length === 0 && checklists.length === 0 && webhooks.length === 0 && clients.length === 0) {
    return createEmptyVendorWorkspace(summary)
  }

  const mappedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? "No email",
    kind: transaction.kind.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    amount: formatMoney(transaction.amount ?? transaction.depositAmount, transaction.currency),
    kyc: transaction.requiresKyc ? "Required" : "Not required",
    contract: transaction.contractTemplateId ? "Attached" : "Pending",
    status: transaction.status,
    date: transaction.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }))

  return {
    ...createEmptyVendorWorkspace(summary),
    summary,
    alerts: buildVendorAlerts(summary),
    actionItems: buildVendorActionItems(summary),
    kpis: buildVendorKpis({
      transactionCount: mappedTransactions.length,
      clientCount: clients.length,
      reviewStatus: summary.reviewStatus,
      stripeConnectionStatus: summary.stripeConnectionStatus,
      profileCompletion: summary.profileCompletion,
    }),
    transactions: mappedTransactions,
    contractTemplates:
      contracts.length > 0
        ? contracts.map((contract) => ({
            title: contract.name,
            description: contract.description ?? "Reusable contract template.",
            tag: contract.isDefault ? "Default" : "Template",
            meta: `Updated ${contract.updatedAt.toLocaleDateString("en-US")}`,
          }))
        : [],
    checklistTemplates:
      checklists.length > 0
        ? checklists.map((checklist) => ({
            title: checklist.name,
            description: checklist.description ?? `${checklist.items.length} requirement items attached to this template.`,
            tag: `${checklist.items.length} items`,
            meta: `Updated ${checklist.updatedAt.toLocaleDateString("en-US")}`,
          }))
        : [],
    clients:
      clients.length > 0
        ? clients.map((client) => ({
            name: client.fullName,
            email: client.email,
            status: "Tracked",
            lastTransaction: "Recent",
          }))
        : [],
    webhooks:
      webhooks.length > 0
        ? webhooks.map((webhook) => ({
            provider: webhook.provider,
            eventType: webhook.eventType,
            status: webhook.status,
            date: webhook.createdAt.toLocaleString("en-US"),
          }))
        : [],
  }
}

export async function getVendorTransactionDetail(transactionId: string): Promise<TransactionDetailRecord | null> {
  if (transactionId === DEMO_TRANSACTION_ID || transactionId === demoTransactionDetail.reference.toLowerCase()) {
    return demoTransactionDetail
  }

  const transaction = await safeQuery(
    () =>
      prisma.transaction.findFirst({
        where: {
          OR: [{ id: transactionId }, { reference: transactionId.toUpperCase() }],
        },
        include: {
          clientProfile: true,
          contractTemplate: true,
          kycVerification: true,
          signatureRecord: true,
          depositAuthorization: true,
        },
      }),
    null
  )

  if (!transaction) {
    return null
  }

  return {
    reference: transaction.reference,
    title: "Transaction detail",
    summaryLine: `${transaction.clientProfile?.fullName ?? "Client pending"} · ${transaction.kind} · ${formatMoney(
      transaction.amount ?? transaction.depositAmount,
      transaction.currency
    )}`,
    facts: [
      { label: "Client", value: transaction.clientProfile?.fullName ?? "Client pending" },
      { label: "Type", value: transaction.kind },
      { label: "Amount", value: formatMoney(transaction.amount ?? transaction.depositAmount, transaction.currency) },
      { label: "Global status", value: transaction.status },
      { label: "KYC", value: transaction.kycVerification?.status ?? (transaction.requiresKyc ? "Required" : "Not required") },
      { label: "Contract", value: transaction.contractTemplate?.name ?? "No template attached" },
      { label: "Signature", value: transaction.signatureRecord?.status ?? "Pending" },
      { label: "Stripe reference", value: transaction.stripePaymentIntentId ?? "Not set" },
      { label: "Updated", value: transaction.updatedAt.toLocaleString("en-US") },
    ],
    timeline: [
      { title: "Transaction created", detail: transaction.createdAt.toLocaleString("en-US") },
      {
        title: "Current status",
        detail: transaction.status,
        pending: !["COMPLETED", "SIGNED"].includes(transaction.status),
      },
    ],
  }
}

export async function getAdminWorkspace(): Promise<AdminWorkspaceRecord> {
  const [vendors, users, invites, logs] = await Promise.all([
    safeQuery(
      () =>
        prisma.vendorProfile.findMany({
          select: {
            id: true,
            userId: true,
            businessName: true,
            businessEmail: true,
            reviewStatus: true,
            stripeConnectionStatus: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.user.findMany({
          include: { vendorProfile: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.invitation.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      []
    ),
  ])

  if (vendors.length === 0 && users.length === 0 && invites.length === 0 && logs.length === 0) {
    return createEmptyAdminWorkspace()
  }

  const pendingReviews = vendors.filter((vendor) => vendor.reviewStatus === "PENDING").length
  const connectedAccounts = vendors.filter((vendor) => vendor.stripeConnectionStatus === "CONNECTED").length

  return {
    ...createEmptyAdminWorkspace(),
    kpis: [
      { label: "Vendors", value: `${vendors.length}`, detail: "Tracked vendor accounts", tone: "neutral" },
      { label: "Pending reviews", value: `${pendingReviews}`, detail: pendingReviews > 0 ? "Need review" : "Nothing waiting", tone: pendingReviews > 0 ? "warning" : "neutral" },
      { label: "Connected payouts", value: `${connectedAccounts}`, detail: "Ready for payments", tone: connectedAccounts > 0 ? "success" : "neutral" },
      { label: "User accounts", value: `${users.length}`, detail: "Across all roles", tone: "neutral" },
    ],
    vendors:
      vendors.length > 0
        ? vendors.map((vendor) => ({
            id: vendor.id,
            userId: vendor.userId,
            businessName: vendor.businessName ?? "Unnamed vendor",
            businessEmail: vendor.businessEmail ?? "No business email",
            reviewStatus: vendor.reviewStatus,
            stripeConnectionStatus: vendor.stripeConnectionStatus,
          }))
        : [],
    users:
      users.length > 0
        ? users.map((user) => ({
            id: user.id,
            name: user.name ?? "Unnamed user",
            email: user.email,
            role: user.role,
            company: user.vendorProfile?.businessName ?? "Conntrazy",
            status: user.vendorProfile?.reviewStatus ?? "Active",
          }))
        : [],
    invites:
      invites.length > 0
        ? invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            expiresAt: invite.expiresAt.toLocaleDateString("en-US"),
          }))
        : [],
    logs:
      logs.length > 0
        ? logs.map((log) => ({
            actor: log.actorType === "SYSTEM" ? "System" : log.actorId ?? "User",
            action: log.action,
            entity: `${log.entityType}${log.entityId ? ` · ${log.entityId}` : ""}`,
            date: log.createdAt.toLocaleString("en-US"),
          }))
        : [],
  }
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailRecord | null> {
  const user = await safeQuery(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        include: { vendorProfile: true },
      }),
    null
  )

  if (!user) {
    return null
  }

  return {
    id: user.id,
    name: user.name ?? "Unnamed user",
    email: user.email,
    role: user.role,
    company: user.vendorProfile?.businessName ?? "Conntrazy",
    status: user.vendorProfile?.reviewStatus ?? "Active",
    vendorProfile: user.vendorProfile
      ? {
          businessName: user.vendorProfile.businessName ?? "Not set",
          businessEmail: user.vendorProfile.businessEmail ?? user.email,
          supportEmail: user.vendorProfile.supportEmail ?? "Not set",
          businessPhone: user.vendorProfile.businessPhone ?? "Not set",
          businessAddress: user.vendorProfile.businessAddress ?? "Not set",
          businessCountry: user.vendorProfile.businessCountry ?? "Not set",
          reviewStatus: user.vendorProfile.reviewStatus,
          stripeConnectionStatus: user.vendorProfile.stripeConnectionStatus,
          profileCompletion: getProfileCompletion(user.vendorProfile),
        }
      : null,
  }
}

export function getDemoTone(status: string) {
  return mapToneFromStatus(status)
}
