import { PaymentKind } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"

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
  links: { reference: string; shareLink: string; shortCode: string; qrStatus: string; state: string }[]
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

const rolePolicies: AdminWorkspaceRecord["rolePolicies"] = [
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
]

function formatMoney(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) {
    return "Not set"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "Not available"
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return "Not available"
  }

  return date.toLocaleString("en-US")
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

function mapToneFromStatus(status: string): AlertRecord["tone"] {
  const normalized = status.toLowerCase()

  if (normalized.includes("not_connected") || normalized.includes("not connected")) {
    return "warning"
  }

  if (normalized.includes("fail") || normalized.includes("reject") || normalized.includes("open") || normalized.includes("suspend")) {
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
    normalized.includes("processed") ||
    normalized.includes("captured") ||
    normalized.includes("released")
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
      description: "You can continue preparing templates and transactions while the review is pending.",
      tone: "info",
    })
  }

  if (summary.stripeConnectionStatus === "NOT_CONNECTED" || summary.stripeConnectionStatus === "PENDING") {
    alerts.push({
      title: "Payout setup is still incomplete",
      description: "Connect your payout account so customer payments and deposit holds can be activated.",
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
      { label: "User accounts", value: "0", detail: "No users yet", tone: "neutral" },
    ],
    vendors: [],
    users: [],
    invites: [],
    rolePolicies,
    logs: [],
    sessions: [],
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

  const summary = buildVendorSummary({
    name: user.name,
    email: user.email,
    vendorProfile: user.vendorProfile,
  })

  const vendorId = user.vendorProfile.id

  const [transactions, contracts, checklists, webhooks, clients] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where: { vendorId },
          include: {
            clientProfile: true,
            contractTemplate: true,
            kycVerification: true,
            signatureRecord: true,
            depositAuthorization: true,
            payments: true,
            dispute: true,
            link: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
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
          take: 10,
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.clientProfile.findMany({
          where: { vendorId },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
      []
    ),
  ])

  const mappedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? "No email",
    kind: transaction.kind.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    amount: formatMoney(
      transaction.amount != null && transaction.amount > 0 ? transaction.amount : transaction.depositAmount,
      transaction.currency
    ),
    kyc: transaction.requiresKyc ? transaction.kycVerification?.status ?? "Required" : "Not required",
    contract: transaction.contractTemplate ? (transaction.signatureRecord ? "Signed" : "Attached") : "Not required",
    status: transaction.status,
    date: formatDate(transaction.createdAt),
  }))

  const latestTransactionByClient = new Map<string, string>()
  transactions.forEach((transaction) => {
    if (transaction.clientProfileId && !latestTransactionByClient.has(transaction.clientProfileId)) {
      latestTransactionByClient.set(transaction.clientProfileId, transaction.reference)
    }
  })

  return {
    ...createEmptyVendorWorkspace(summary),
    summary,
    alerts: buildVendorAlerts(summary),
    kpis: buildVendorKpis({
      transactionCount: transactions.length,
      clientCount: clients.length,
      reviewStatus: summary.reviewStatus,
      stripeConnectionStatus: summary.stripeConnectionStatus,
      profileCompletion: summary.profileCompletion,
    }),
    actionItems: buildVendorActionItems(summary),
    transactions: mappedTransactions,
    contractTemplates: contracts.map((contract) => ({
      title: contract.name,
      description: contract.description ?? "Reusable contract template.",
      tag: contract.isDefault ? "Default" : "Template",
      meta: `Updated ${formatDate(contract.updatedAt)}`,
    })),
    checklistTemplates: checklists.map((checklist) => ({
      title: checklist.name,
      description: checklist.description ?? `${checklist.items.length} requirement items attached to this template.`,
      tag: `${checklist.items.length} items`,
      meta: `Updated ${formatDate(checklist.updatedAt)}`,
    })),
    kycCases: transactions
      .filter((transaction) => transaction.requiresKyc || transaction.kycVerification)
      .map((transaction) => ({
        client: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        status: transaction.kycVerification?.status ?? "PENDING",
        provider: transaction.kycVerification?.provider ?? "Stripe Identity",
        note: transaction.kycVerification?.summary ?? "Verification linked to the live transaction flow.",
      })),
    signatures: transactions
      .filter((transaction) => transaction.signatureRecord)
      .map((transaction) => ({
        signer: transaction.signatureRecord?.signerName ?? transaction.clientProfile?.fullName ?? "Client",
        reference: transaction.reference,
        status: transaction.signatureRecord?.status ?? "PENDING",
        template: transaction.contractTemplate?.name ?? "Agreement",
        date: formatDateTime(transaction.signatureRecord?.signedAt ?? transaction.signatureRecord?.createdAt),
      })),
    deposits: transactions
      .filter((transaction) => transaction.depositAuthorization)
      .map((transaction) => ({
        client: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        amount: formatMoney(transaction.depositAuthorization?.amount, transaction.depositAuthorization?.currency ?? transaction.currency),
        status: transaction.depositAuthorization?.status ?? "PENDING",
        date: formatDateTime(
          transaction.depositAuthorization?.capturedAt ??
            transaction.depositAuthorization?.releasedAt ??
            transaction.depositAuthorization?.authorizedAt
        ),
      })),
    payments: transactions.flatMap((transaction) =>
      transaction.payments
        .filter((payment) => payment.kind !== PaymentKind.DEPOSIT_AUTHORIZATION)
        .map((payment) => ({
          client: transaction.clientProfile?.fullName ?? "Client pending",
          reference: transaction.reference,
          amount: formatMoney(payment.amount, payment.currency),
          status: payment.status,
          date: formatDateTime(payment.processedAt ?? payment.createdAt),
        }))
    ),
    disputes: transactions
      .filter((transaction) => transaction.dispute)
      .map((transaction) => ({
        client: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        status: transaction.dispute?.status ?? "OPEN",
        summary: transaction.dispute?.summary ?? "Customer issue linked to this workflow.",
      })),
    clients: clients.map((client) => ({
      name: client.fullName,
      email: client.email,
      status: "Tracked",
      lastTransaction: latestTransactionByClient.get(client.id) ?? "Recent",
    })),
    links: transactions
      .filter((transaction) => transaction.link)
      .map((transaction) => ({
        reference: transaction.reference,
        shareLink: `${getAppBaseUrl()}/t/${transaction.link?.token ?? ""}`,
        shortCode: transaction.link?.shortCode ?? "Not set",
        qrStatus: transaction.link?.qrCodeSvg ? "Ready" : "Unavailable",
        state: transaction.link?.completedAt ? "Completed" : transaction.link?.openedAt ? "Opened" : "Issued",
      })),
    webhooks: webhooks.map((webhook) => ({
      provider: webhook.provider,
      eventType: webhook.eventType,
      status: webhook.status,
      date: formatDateTime(webhook.createdAt),
    })),
  }
}

export async function getVendorTransactionDetail(transactionId: string): Promise<TransactionDetailRecord | null> {
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
          payments: true,
          events: {
            orderBy: { occurredAt: "asc" },
          },
        },
      }),
    null
  )

  if (!transaction) {
    return null
  }

  return {
    reference: transaction.reference,
    title: transaction.title,
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
      {
        label: "Deposit",
        value: transaction.depositAuthorization ? `${transaction.depositAuthorization.status} · ${formatMoney(transaction.depositAuthorization.amount, transaction.depositAuthorization.currency)}` : "Not used",
      },
      { label: "Updated", value: formatDateTime(transaction.updatedAt) },
    ],
    timeline:
      transaction.events.length > 0
        ? transaction.events.map((event) => ({
            title: event.title,
            detail: event.detail ? `${formatDateTime(event.occurredAt)} · ${event.detail}` : formatDateTime(event.occurredAt),
            pending: event.type === "DEPOSIT_AUTHORIZED" && transaction.depositAuthorization?.status === "AUTHORIZED",
          }))
        : [
            { title: "Transaction created", detail: formatDateTime(transaction.createdAt) },
            { title: "Current status", detail: transaction.status, pending: transaction.status !== "COMPLETED" },
          ],
  }
}

export async function getAdminWorkspace(): Promise<AdminWorkspaceRecord> {
  const [vendors, users, invites, logs, sessions, transactions, webhooks] = await Promise.all([
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
    safeQuery(
      () =>
        prisma.session.findMany({
          include: {
            user: {
              include: { vendorProfile: true },
            },
          },
          orderBy: { expires: "desc" },
          take: 20,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.findMany({ take: 200 }), []),
    safeQuery(
      () =>
        prisma.webhookEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      []
    ),
  ])

  if (vendors.length === 0 && users.length === 0 && invites.length === 0 && logs.length === 0 && sessions.length === 0 && webhooks.length === 0) {
    return createEmptyAdminWorkspace()
  }

  const pendingReviews = vendors.filter((vendor) => vendor.reviewStatus === "PENDING").length
  const connectedAccounts = vendors.filter((vendor) => vendor.stripeConnectionStatus === "CONNECTED").length

  const combinedLogs = [
    ...logs.map((log) => ({
      actor: log.actorType === "SYSTEM" ? "System" : log.actorId ?? "User",
      action: log.action,
      entity: `${log.entityType}${log.entityId ? ` · ${log.entityId}` : ""}`,
      createdAt: log.createdAt,
    })),
    ...webhooks.map((webhook) => ({
      actor: "System",
      action: `Processed ${webhook.eventType}`,
      entity: `${webhook.provider} webhook`,
      createdAt: webhook.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20)

  return {
    kpis: [
      { label: "Vendors", value: `${vendors.length}`, detail: "Tracked vendor accounts", tone: "neutral" },
      { label: "Pending reviews", value: `${pendingReviews}`, detail: pendingReviews > 0 ? "Need review" : "Nothing waiting", tone: pendingReviews > 0 ? "warning" : "neutral" },
      { label: "Connected payouts", value: `${connectedAccounts}`, detail: "Ready for payments", tone: connectedAccounts > 0 ? "success" : "neutral" },
      { label: "Transactions", value: `${transactions.length}`, detail: "Across all workspaces", tone: "neutral" },
    ],
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName ?? "Unnamed vendor",
      businessEmail: vendor.businessEmail ?? "No business email",
      reviewStatus: vendor.reviewStatus,
      stripeConnectionStatus: vendor.stripeConnectionStatus,
    })),
    users: users.map((user) => ({
      id: user.id,
      name: user.name ?? "Unnamed user",
      email: user.email,
      role: user.role,
      company: user.vendorProfile?.businessName ?? "Conntrazy",
      status: user.vendorProfile?.reviewStatus ?? "Active",
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: formatDate(invite.expiresAt),
    })),
    rolePolicies,
    logs: combinedLogs.map((log) => ({
      actor: log.actor,
      action: log.action,
      entity: log.entity,
      date: formatDateTime(log.createdAt),
    })),
    sessions: sessions.map((session) => ({
      user: session.user?.name ?? session.user?.email ?? "Unknown user",
      role: session.user?.role ?? "UNKNOWN",
      state: session.expires > new Date() ? "Active" : "Expired",
      lastSeen: formatDateTime(session.expires),
    })),
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
