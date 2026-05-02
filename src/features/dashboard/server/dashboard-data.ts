import {
  DisputeStatus,
  InvitationStatus,
  KycStatus,
  PaymentKind,
  PaymentStatus,
  Prisma,
  SignatureStatus,
  StripeConnectionStatus,
  TransactionKind,
  TransactionStatus,
  UserRole,
  VendorStatus,
  WebhookStatus,
} from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import {
  adminInviteStatusOptions,
  adminLogSourceOptions,
  adminReviewStatusOptions,
  adminRoleOptions,
  adminSessionStateOptions,
  adminStripeConnectionOptions,
  normalizeFilterOptionValue,
  vendorDisputeStatusOptions,
  vendorKycStatusOptions,
  vendorLinkStateOptions,
  vendorPaymentStatusOptions,
  vendorSignatureStatusOptions,
  vendorTransactionKindOptions,
  vendorTransactionStatusOptions,
  vendorWebhookStatusOptions,
} from "@/features/dashboard/filter-options"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"

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

export type AdminUserListItem = {
  id: string
  name: string
  email: string
  role: string
  company: string
  reviewStatus: string | null
  stripeConnectionStatus: string | null
  joinedAt: string
}

export type AdminUserListData = {
  users: AdminUserListItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminUserDetailRecord = {
  id: string
  name: string
  email: string
  role: string
  company: string
  status: string
  emailVerified: string | null
  joinedAt: string
  vendorProfile: null | {
    id: string
    businessName: string
    businessEmail: string
    supportEmail: string
    businessPhone: string
    businessAddress: string
    businessCountry: string
    reviewStatus: string
    stripeConnectionStatus: string
    profileCompletion: number
    transactionCount: number
    clientCount: number
  }
}

export type AdminVendorRecord = {
  id: string
  userId: string
  userName: string
  userEmail: string
  businessName: string
  businessEmail: string
  businessPhone: string
  businessCountry: string
  reviewStatus: string
  stripeConnectionStatus: string
  profileCompletion: number
  transactionCount: number
  clientCount: number
  joinedAt: string
}

export type AdminVendorListData = {
  kpis: SummaryKpi[]
  vendors: AdminVendorRecord[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginatedResult<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type VendorTransactionsData = PaginatedResult<TransactionRecord>
export type VendorKycListData = PaginatedResult<WorkspaceRecord["kycCases"][number]>
export type VendorSignatureListData = PaginatedResult<WorkspaceRecord["signatures"][number]>
export type VendorDepositListData = PaginatedResult<WorkspaceRecord["deposits"][number]>
export type VendorPaymentListData = PaginatedResult<WorkspaceRecord["payments"][number]>
export type VendorDisputeListData = PaginatedResult<WorkspaceRecord["disputes"][number]>
export type VendorClientListData = PaginatedResult<WorkspaceRecord["clients"][number]>
export type VendorLinkListData = PaginatedResult<WorkspaceRecord["links"][number]>
export type VendorWebhookListData = PaginatedResult<WorkspaceRecord["webhooks"][number]>
export type AdminInviteListData = PaginatedResult<AdminWorkspaceRecord["invites"][number]>
export type AdminLogListData = PaginatedResult<AdminWorkspaceRecord["logs"][number]>
export type AdminSessionListData = PaginatedResult<AdminWorkspaceRecord["sessions"][number]>

type SearchOnlyFilters = {
  q?: string
}

type StatusFilters = SearchOnlyFilters & {
  status?: string
}

type TransactionFilters = StatusFilters & {
  kind?: string
}

type LinkFilters = SearchOnlyFilters & {
  state?: string
}

type AdminUserFilters = SearchOnlyFilters & {
  role?: string
  reviewStatus?: string
}

type AdminVendorFilters = SearchOnlyFilters & {
  reviewStatus?: string
  stripeStatus?: string
}

type AdminInviteFilters = SearchOnlyFilters & {
  role?: string
  status?: string
}

type AdminLogFilters = SearchOnlyFilters & {
  source?: string
}

type AdminSessionFilters = SearchOnlyFilters & {
  role?: string
  state?: string
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

function buildPaginatedResult<T>(items: T[], totalCount: number, page: number, pageSize: number): PaginatedResult<T> {
  return {
    items,
    ...buildPaginationMeta(totalCount, page, pageSize),
  }
}

function createEmptyPaginatedResult<T>(page: number, pageSize: number): PaginatedResult<T> {
  return buildPaginatedResult([], 0, page, pageSize)
}

async function getVendorContextByEmail(email: string | undefined | null) {
  if (!email) {
    return null
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
    return null
  }

  return {
    user,
    vendorProfile: user.vendorProfile,
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

function formatDisplayLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeSearchTerm(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: Prisma.QueryMode.insensitive,
  }
}

function mapTransactionListRecord(transaction: {
  id: string
  reference: string
  kind: string
  amount: number | null
  depositAmount: number | null
  currency: string
  status: string
  createdAt: Date
  clientProfile: { fullName: string; email: string } | null
  requiresKyc: boolean
  kycVerification?: { status: string } | null
  contractTemplateId?: string | null
  signatureRecord?: { status: string } | null
}) {
  return {
    id: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? "No email",
    kind: formatDisplayLabel(transaction.kind),
    amount: formatMoney(
      transaction.amount != null && transaction.amount > 0 ? transaction.amount : transaction.depositAmount,
      transaction.currency
    ),
    kyc: transaction.requiresKyc ? transaction.kycVerification?.status ?? "Required" : "Not required",
    contract:
      transaction.contractTemplateId != null
        ? transaction.signatureRecord?.status === "SIGNED"
          ? "Signed"
          : "Attached"
        : "Not required",
    status: transaction.status,
    date: formatDate(transaction.createdAt),
  }
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

export async function getVendorTransactionsPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: TransactionFilters = {}
): Promise<VendorTransactionsData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorTransactionStatusOptions) as TransactionStatus | undefined
  const kind = normalizeFilterOptionValue(filters.kind, vendorTransactionKindOptions) as TransactionKind | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            { title: containsInsensitive(search) },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            clientProfile: { select: { fullName: true, email: true } },
            kycVerification: { select: { status: true } },
            signatureRecord: { select: { status: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => mapTransactionListRecord(transaction)),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorKycPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorKycListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorKycStatusOptions) as KycStatus | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    AND: [
      { OR: [{ requiresKyc: true }, { kycVerification: { isNot: null } }] },
      ...(status
        ? status === KycStatus.PENDING
          ? [{ OR: [{ kycVerification: { is: null } }, { kycVerification: { is: { status } } }] }]
          : [{ kycVerification: { is: { status } } }]
        : []),
      ...(search
        ? [
            {
              OR: [
                { reference: containsInsensitive(search) },
                {
                  clientProfile: {
                    is: {
                      OR: [
                        { fullName: containsInsensitive(search) },
                        { email: containsInsensitive(search) },
                      ],
                    },
                  },
                },
                { kycVerification: { is: { provider: containsInsensitive(search) } } },
                { kycVerification: { is: { summary: containsInsensitive(search) } } },
              ],
            },
          ]
        : []),
    ],
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            clientProfile: { select: { fullName: true } },
            kycVerification: { select: { status: true, provider: true, summary: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => ({
      client: transaction.clientProfile?.fullName ?? "Client pending",
      reference: transaction.reference,
      status: transaction.kycVerification?.status ?? "PENDING",
      provider: transaction.kycVerification?.provider ?? "Stripe Identity",
      note: transaction.kycVerification?.summary ?? "Verification linked to the live transaction flow.",
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorSignaturesPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorSignatureListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorSignatureStatusOptions) as SignatureStatus | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    signatureRecord: { isNot: null },
    ...(status ? { signatureRecord: { is: { status } } } : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
            { contractTemplate: { is: { name: containsInsensitive(search) } } },
            { signatureRecord: { is: { signerName: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            clientProfile: { select: { fullName: true } },
            contractTemplate: { select: { name: true } },
            signatureRecord: { select: { signerName: true, status: true, signedAt: true, createdAt: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => ({
      signer: transaction.signatureRecord?.signerName ?? transaction.clientProfile?.fullName ?? "Client",
      reference: transaction.reference,
      status: transaction.signatureRecord?.status ?? "PENDING",
      template: transaction.contractTemplate?.name ?? "Agreement",
      date: formatDateTime(transaction.signatureRecord?.signedAt ?? transaction.signatureRecord?.createdAt),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorDepositsPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorDepositListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorPaymentStatusOptions) as PaymentStatus | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    depositAuthorization: { isNot: null },
    ...(status ? { depositAuthorization: { is: { status } } } : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            clientProfile: { select: { fullName: true } },
            depositAuthorization: {
              select: { amount: true, currency: true, status: true, capturedAt: true, releasedAt: true, authorizedAt: true },
            },
          },
          orderBy: { updatedAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => ({
      client: transaction.clientProfile?.fullName ?? "Client pending",
      reference: transaction.reference,
      amount: formatMoney(
        transaction.depositAuthorization?.amount,
        transaction.depositAuthorization?.currency ?? transaction.currency
      ),
      status: transaction.depositAuthorization?.status ?? "PENDING",
      date: formatDateTime(
        transaction.depositAuthorization?.capturedAt ??
          transaction.depositAuthorization?.releasedAt ??
          transaction.depositAuthorization?.authorizedAt
      ),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorPaymentsPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorPaymentListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorPaymentStatusOptions) as PaymentStatus | undefined

  const where: Prisma.PaymentWhereInput = {
    transaction: { vendorId: context.vendorProfile.id },
    NOT: { kind: PaymentKind.DEPOSIT_AUTHORIZATION },
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { transaction: { is: { reference: containsInsensitive(search) } } },
            {
              transaction: {
                is: {
                  clientProfile: {
                    is: {
                      OR: [
                        { fullName: containsInsensitive(search) },
                        { email: containsInsensitive(search) },
                      ],
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
  }

  const [payments, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.payment.findMany({
          where,
          include: {
            transaction: {
              select: {
                reference: true,
                clientProfile: { select: { fullName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.payment.count({ where }), 0),
  ])

  return buildPaginatedResult(
    payments.map((payment) => ({
      client: payment.transaction.clientProfile?.fullName ?? "Client pending",
      reference: payment.transaction.reference,
      amount: formatMoney(payment.amount, payment.currency),
      status: payment.status,
      date: formatDateTime(payment.processedAt ?? payment.createdAt),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorDisputesPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorDisputeListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorDisputeStatusOptions) as DisputeStatus | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    dispute: { isNot: null },
    ...(status ? { dispute: { is: { status } } } : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
            { dispute: { is: { summary: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            clientProfile: { select: { fullName: true } },
            dispute: { select: { status: true, summary: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => ({
      client: transaction.clientProfile?.fullName ?? "Client pending",
      reference: transaction.reference,
      status: transaction.dispute?.status ?? "OPEN",
      summary: transaction.dispute?.summary ?? "Issue recorded on this transaction.",
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorClientsPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: SearchOnlyFilters = {}
): Promise<VendorClientListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const where: Prisma.ClientProfileWhereInput = {
    vendorId: context.vendorProfile.id,
    ...(search
      ? {
          OR: [
            { fullName: containsInsensitive(search) },
            { email: containsInsensitive(search) },
            { companyName: containsInsensitive(search) },
          ],
        }
      : {}),
  }

  const [clients, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.clientProfile.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.clientProfile.count({ where }), 0),
  ])

  const recentTransactions = clients.length
    ? await safeQuery(
        () =>
          prisma.transaction.findMany({
            where: {
              vendorId: context.vendorProfile.id,
              clientProfileId: { in: clients.map((client) => client.id) },
            },
            select: { clientProfileId: true, reference: true },
            orderBy: { createdAt: "desc" },
          }),
        []
      )
    : []

  const latestTransactionByClient = new Map<string, string>()
  for (const transaction of recentTransactions) {
    if (transaction.clientProfileId && !latestTransactionByClient.has(transaction.clientProfileId)) {
      latestTransactionByClient.set(transaction.clientProfileId, transaction.reference)
    }
  }

  return buildPaginatedResult(
    clients.map((client) => ({
      name: client.fullName,
      email: client.email,
      status: "Tracked",
      lastTransaction: latestTransactionByClient.get(client.id) ?? "Recent",
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorLinksPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: LinkFilters = {}
): Promise<VendorLinkListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const state = normalizeFilterOptionValue(filters.state, vendorLinkStateOptions)
  const linkFilter: Prisma.TransactionLinkNullableScalarRelationFilter =
    state === "COMPLETED"
      ? { is: { completedAt: { not: null } } }
      : state === "OPENED"
        ? { is: { completedAt: null, openedAt: { not: null } } }
        : state === "ISSUED"
          ? { is: { completedAt: null, openedAt: null } }
          : { isNot: null }

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    link: linkFilter,
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
            { link: { is: { shortCode: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }

  const [transactions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where,
          include: {
            link: { select: { token: true, shortCode: true, qrCodeSvg: true, completedAt: true, openedAt: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  return buildPaginatedResult(
    transactions.map((transaction) => ({
      reference: transaction.reference,
      shareLink: `${getAppBaseUrl()}/t/${transaction.link?.token ?? ""}`,
      shortCode: transaction.link?.shortCode ?? "Not set",
      qrStatus: transaction.link?.qrCodeSvg ? "Ready" : "Unavailable",
      state: transaction.link?.completedAt ? "Completed" : transaction.link?.openedAt ? "Opened" : "Issued",
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorWebhooksPageData(
  email: string | undefined | null,
  page: number = 1,
  pageSize: number = 20,
  filters: StatusFilters = {}
): Promise<VendorWebhookListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return createEmptyPaginatedResult(pagination.page, pagination.pageSize)
  }

  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorWebhookStatusOptions) as WebhookStatus | undefined
  const where: Prisma.WebhookEventWhereInput = {
    vendorId: context.vendorProfile.id,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { provider: containsInsensitive(search) },
            { eventType: containsInsensitive(search) },
          ],
        }
      : {}),
  }

  const [webhooks, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.webhookEvent.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.webhookEvent.count({ where }), 0),
  ])

  return buildPaginatedResult(
    webhooks.map((webhook) => ({
      provider: webhook.provider,
      eventType: webhook.eventType,
      status: webhook.status,
      date: formatDateTime(webhook.createdAt),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
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
        include: {
          vendorProfile: {
            include: {
              _count: { select: { transactions: true, clients: true } },
            },
          },
        },
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
    emailVerified: user.emailVerified ? formatDateTime(user.emailVerified) : null,
    joinedAt: formatDateTime(user.createdAt),
    vendorProfile: user.vendorProfile
      ? {
          id: user.vendorProfile.id,
          businessName: user.vendorProfile.businessName ?? "Not set",
          businessEmail: user.vendorProfile.businessEmail ?? user.email,
          supportEmail: user.vendorProfile.supportEmail ?? "Not set",
          businessPhone: user.vendorProfile.businessPhone ?? "Not set",
          businessAddress: user.vendorProfile.businessAddress ?? "Not set",
          businessCountry: user.vendorProfile.businessCountry ?? "Not set",
          reviewStatus: user.vendorProfile.reviewStatus,
          stripeConnectionStatus: user.vendorProfile.stripeConnectionStatus,
          profileCompletion: getProfileCompletion(user.vendorProfile),
          transactionCount: user.vendorProfile._count.transactions,
          clientCount: user.vendorProfile._count.clients,
        }
      : null,
  }
}

export async function getAdminVendors(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminVendorFilters = {}
): Promise<AdminVendorListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const reviewStatus = normalizeFilterOptionValue(filters.reviewStatus, adminReviewStatusOptions) as VendorStatus | undefined
  const stripeStatus = normalizeFilterOptionValue(filters.stripeStatus, adminStripeConnectionOptions) as StripeConnectionStatus | undefined

  const where: Prisma.VendorProfileWhereInput = {
    ...(reviewStatus ? { reviewStatus } : {}),
    ...(stripeStatus ? { stripeConnectionStatus: stripeStatus } : {}),
    ...(search
      ? {
          OR: [
            { businessName: containsInsensitive(search) },
            { businessEmail: containsInsensitive(search) },
            { businessCountry: containsInsensitive(search) },
            { businessPhone: containsInsensitive(search) },
            {
              user: {
                is: {
                  OR: [
                    { name: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const [vendors, totalCount, pendingCount, approvedCount, rejectedCount, suspendedCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.vendorProfile.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
            _count: { select: { transactions: true, clients: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.vendorProfile.count({ where }), 0),
    safeQuery(() => prisma.vendorProfile.count({ where: { reviewStatus: "PENDING" } }), 0),
    safeQuery(() => prisma.vendorProfile.count({ where: { reviewStatus: "APPROVED" } }), 0),
    safeQuery(() => prisma.vendorProfile.count({ where: { reviewStatus: "REJECTED" } }), 0),
    safeQuery(() => prisma.vendorProfile.count({ where: { reviewStatus: "SUSPENDED" } }), 0),
  ])

  const counts = {
    total: totalCount,
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    suspended: suspendedCount,
  }

  const kpis: SummaryKpi[] = [
    { label: "Total vendors", value: `${counts.total}`, detail: "All registered vendor accounts", tone: "neutral" },
    {
      label: "Pending review",
      value: `${counts.pending}`,
      detail: counts.pending > 0 ? "Waiting for approval" : "Nothing pending",
      tone: counts.pending > 0 ? "warning" : "neutral",
    },
    { label: "Approved", value: `${counts.approved}`, detail: "Active on the platform", tone: counts.approved > 0 ? "success" : "neutral" },
    {
      label: "Rejected / Suspended",
      value: `${counts.rejected + counts.suspended}`,
      detail: counts.rejected + counts.suspended > 0 ? "Blocked accounts" : "No blocked accounts",
      tone: counts.rejected + counts.suspended > 0 ? "danger" : "neutral",
    },
  ]

  return {
    kpis,
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      userId: vendor.userId,
      userName: vendor.user?.name ?? "Unnamed",
      userEmail: vendor.user?.email ?? "No email",
      businessName: vendor.businessName ?? "Unnamed vendor",
      businessEmail: vendor.businessEmail ?? "Not set",
      businessPhone: vendor.businessPhone ?? "Not set",
      businessCountry: vendor.businessCountry ?? "Not set",
      reviewStatus: vendor.reviewStatus,
      stripeConnectionStatus: vendor.stripeConnectionStatus,
      profileCompletion: getProfileCompletion(vendor),
      transactionCount: vendor._count.transactions,
      clientCount: vendor._count.clients,
      joinedAt: formatDate(vendor.user?.createdAt),
    })),
    ...buildPaginationMeta(totalCount, pagination.page, pagination.pageSize),
  }
}

export async function getAdminUsers(
  page: number = 1,
  pageSize: number = 25,
  filters: AdminUserFilters = {}
): Promise<AdminUserListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 25, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const role = normalizeFilterOptionValue(filters.role, adminRoleOptions) as UserRole | undefined
  const reviewStatus = normalizeFilterOptionValue(filters.reviewStatus, adminReviewStatusOptions) as VendorStatus | undefined

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(reviewStatus ? { vendorProfile: { is: { reviewStatus } } } : {}),
    ...(search
      ? {
          OR: [
            { name: containsInsensitive(search) },
            { email: containsInsensitive(search) },
            {
              vendorProfile: {
                is: {
                  OR: [
                    { businessName: containsInsensitive(search) },
                    { businessEmail: containsInsensitive(search) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const [users, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            vendorProfile: {
              select: {
                businessName: true,
                reviewStatus: true,
                stripeConnectionStatus: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.user.count({ where }), 0),
  ])

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name ?? "Unnamed user",
      email: user.email,
      role: user.role,
      company: user.vendorProfile?.businessName ?? "—",
      reviewStatus: user.vendorProfile?.reviewStatus ?? null,
      stripeConnectionStatus: user.vendorProfile?.stripeConnectionStatus ?? null,
      joinedAt: formatDate(user.createdAt),
    })),
    ...buildPaginationMeta(totalCount, pagination.page, pagination.pageSize),
  }
}

export async function getAdminInvites(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminInviteFilters = {}
): Promise<AdminInviteListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const role = normalizeFilterOptionValue(filters.role, adminRoleOptions) as UserRole | undefined
  const status = normalizeFilterOptionValue(filters.status, adminInviteStatusOptions) as InvitationStatus | undefined

  const where: Prisma.InvitationWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search ? { email: containsInsensitive(search) } : {}),
  }

  const [invites, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.invitation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.invitation.count({ where }), 0),
  ])

  return buildPaginatedResult(
    invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: formatDate(invite.expiresAt),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getAdminLogs(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminLogFilters = {}
): Promise<AdminLogListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const fetchWindow = pagination.page * pagination.pageSize
  const search = normalizeSearchTerm(filters.q)
  const source = normalizeFilterOptionValue(filters.source, adminLogSourceOptions)

  const logWhere: Prisma.AuditLogWhereInput | undefined =
    source === "WEBHOOK"
      ? undefined
      : search
        ? {
            OR: [
              { action: containsInsensitive(search) },
              { entityType: containsInsensitive(search) },
              { entityId: containsInsensitive(search) },
              { actorId: containsInsensitive(search) },
              {
                actor: {
                  is: {
                    OR: [
                      { name: containsInsensitive(search) },
                      { email: containsInsensitive(search) },
                    ],
                  },
                },
              },
            ],
          }
        : {}

  const webhookWhere: Prisma.WebhookEventWhereInput | undefined =
    source === "AUDIT"
      ? undefined
      : search
        ? {
            OR: [
              { provider: containsInsensitive(search) },
              { eventType: containsInsensitive(search) },
            ],
          }
        : {}

  const [logs, webhooks, logCount, webhookCount] = await Promise.all([
    logWhere === undefined
      ? Promise.resolve([])
      : safeQuery(
          () =>
            prisma.auditLog.findMany({
              where: logWhere,
              include: {
                actor: {
                  select: { name: true, email: true },
                },
              },
              orderBy: { createdAt: "desc" },
              take: fetchWindow,
            }),
          []
        ),
    webhookWhere === undefined
      ? Promise.resolve([])
      : safeQuery(
          () =>
            prisma.webhookEvent.findMany({
              where: webhookWhere,
              orderBy: { createdAt: "desc" },
              take: fetchWindow,
            }),
          []
        ),
    logWhere === undefined ? Promise.resolve(0) : safeQuery(() => prisma.auditLog.count({ where: logWhere }), 0),
    webhookWhere === undefined ? Promise.resolve(0) : safeQuery(() => prisma.webhookEvent.count({ where: webhookWhere }), 0),
  ])

  const items = [
    ...logs.map((log) => ({
      actor:
        log.actorType === "SYSTEM"
          ? "System"
          : log.actor?.name ?? log.actor?.email ?? log.actorId ?? "User",
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
    .slice(pagination.skip, pagination.skip + pagination.pageSize)
    .map((item) => ({
      actor: item.actor,
      action: item.action,
      entity: item.entity,
      date: formatDateTime(item.createdAt),
    }))

  return buildPaginatedResult(items, logCount + webhookCount, pagination.page, pagination.pageSize)
}

export async function getAdminSessions(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminSessionFilters = {}
): Promise<AdminSessionListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const role = normalizeFilterOptionValue(filters.role, adminRoleOptions) as UserRole | undefined
  const state = normalizeFilterOptionValue(filters.state, adminSessionStateOptions)
  const now = new Date()

  const where: Prisma.SessionWhereInput = {
    ...(role ? { user: { is: { role } } } : {}),
    ...(state
      ? state === "ACTIVE"
        ? { expires: { gt: now } }
        : { expires: { lte: now } }
      : {}),
    ...(search
      ? {
          user: {
            is: {
              OR: [
                { name: containsInsensitive(search) },
                { email: containsInsensitive(search) },
              ],
            },
          },
        }
      : {}),
  }

  const [sessions, totalCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.session.findMany({
          where,
          include: {
            user: {
              include: { vendorProfile: true },
            },
          },
          orderBy: { expires: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.session.count({ where }), 0),
  ])

  return buildPaginatedResult(
    sessions.map((session) => ({
      user: session.user?.name ?? session.user?.email ?? "Unknown user",
      role: session.user?.role ?? "UNKNOWN",
      state: session.expires > new Date() ? "Active" : "Expired",
      lastSeen: formatDateTime(session.expires),
    })),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export function getStatusTone(status: string) {
  return mapToneFromStatus(status)
}
