import {
  type ChecklistItem,
  type ChecklistTemplate,
  type ContractTemplate,
  DisputeStatus,
  InvitationStatus,
  KycStatus,
  PaymentKind,
  PaymentStatus,
  Prisma,
  SignatureStatus,
  StripeConnectionStatus,
  TransactionKind,
  TransactionLinkStatus,
  TransactionStatus,
  TransactionEventType,
  UserRole,
  type VendorSubscription,
  VendorStatus,
  WebhookStatus,
} from "@prisma/client"

import {
  canUseKyc,
  getContractTemplateLimit,
  getESignatureLimit,
  getKycLimit,
  getQrCodeLimit,
  getTransactionLimit,
  hasActiveSubscription,
  maxTeamUsers,
  remainingKycVerifications,
  remainingQrCodes,
  remainingTransactions,
} from "@/features/subscriptions/server/feature-gates"
import { isRequirementSlotSatisfied } from "@/features/transactions/contract-flow"
import { isLiveLinkStatus } from "@/features/transactions/server/transaction-links"
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
import { getStatusTone as getStatusToneValue } from "@/features/dashboard/lib/status-tone"
import {
  buildVendorDisputeEvidenceAsset,
  parseDisputeEvidenceAssets,
  type VendorDisputeEvidenceAsset,
} from "@/features/dashboard/server/dispute-evidence"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { buildPaginationMeta, resolvePagination, type PaginationMeta } from "@/lib/pagination"

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

export type VendorLinkRecord = {
  id: string
  transactionId: string
  reference: string
  clientName: string
  clientEmail: string
  title: string
  kind: string
  serviceAmount: string
  depositAmount: string
  shareLink: string
  shortCode: string
  lastActivity: string
  status: string
  notes: string
  expiresAt: string | null
  expiresAtLabel: string
  cancelledAtLabel: string | null
  cancelReason: string | null
  cancelledBy: string | null
  qrReady: boolean
  qrCodeSvg: string | null
  canGenerateQr: boolean
  qrUnavailableReason: string | null
  canEdit: boolean
  canCancel: boolean
}

export type VendorActionsUsageRecord = {
  planName: string
  planSlug: string
  status: string
  periodEnd: string | null
  isTrial: boolean
  transactions: { used: number; limit: number | null; remaining: number | null }
  qrCodes: { used: number; limit: number | null; remaining: number | null }
  kyc: { used: number; limit: number | null; remaining: number | null; allowed: boolean }
}

export type VendorCreateLinkDialogData = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
}

export type VendorDepositRecord = {
  transactionId: string
  client: string
  reference: string
  amount: string
  amountCents: number
  currency: string
  status: string
  date: string
  canManage: boolean
}

export type VendorWebhookRecord = {
  provider: string
  eventType: string
  status: string
  date: string
  reference: string
  error: string | null
  detail: string | null
}

export type SubscriptionUsageRecord = {
  planName: string
  planSlug: string
  status: string
  periodEnd: string | null
  isTrial: boolean
  transactions: { used: number; limit: number | null }
  eSignatures: { used: number; limit: number | null }
  qrCodes: { used: number; limit: number | null }
  contractTemplates: { used: number; limit: number | null }
  kyc: { used: number; limit: number | null; allowed: boolean }
  teamUsers: { used: number; limit: number | null }
}

export type VendorOverviewFlowRecord = {
  linkSent: number
  customerActive: number
  kycReady: number
  contractReady: number
  signed: number
  completed: number
  disputed: number
  cancelled: number
}

export type VendorOverviewActivityRecord = {
  id: string
  type: TransactionEventType | "TRANSACTION_CREATED"
  reference: string
  transactionId: string
  transactionTitle: string | null
  clientName: string | null
  occurredAt: string
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
  stats: {
    totalTransactions: number
    totalClients: number
    activeDeposits: number
    signedContracts: number
    serviceRevenue: number
    depositsCaptured: number
    depositsReleased: number
    depositCaptureCount: number
    depositReleaseCount: number
  }
  subscriptionUsage: SubscriptionUsageRecord | null
  overviewFlow: VendorOverviewFlowRecord
  overviewActivity: VendorOverviewActivityRecord[]
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
  signatures: {
    transactionId: string
    signer: string
    reference: string
    status: string
    template: string
    date: string
    hasSignatureImage: boolean
  }[]
  deposits: VendorDepositRecord[]
  payments: { client: string; reference: string; amount: string; status: string; date: string }[]
  disputes: { transactionId: string; client: string; reference: string; status: string; summary: string }[]
  clients: { name: string; email: string; status: string; lastTransaction: string | null }[]
  links: VendorLinkRecord[]
  webhooks: VendorWebhookRecord[]
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
    ownerFirstName: string
    ownerLastName: string
    businessName: string
    businessEmail: string
    supportEmail: string
    businessPhone: string
    businessAddress: string
    businessCountry: string
    registrationNumber: string
    vatNumber: string
    preferredLocale: string
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
export type VendorDepositListData = PaginatedResult<VendorDepositRecord>
export type VendorPaymentListData = PaginatedResult<WorkspaceRecord["payments"][number]>
export type VendorDisputeListData = PaginatedResult<WorkspaceRecord["disputes"][number]>
export type VendorClientListData = PaginatedResult<WorkspaceRecord["clients"][number]>
export type VendorLinkListData = PaginatedResult<WorkspaceRecord["links"][number]>
export type VendorWebhookListData = PaginatedResult<VendorWebhookRecord>
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
  kind?: string
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

function formatAuditMetadataSummary(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const data = metadata as Record<string, unknown>
  const parts: string[] = []
  const currency = typeof data.currency === "string" ? data.currency : null

  if (typeof data.processedAmount === "number" && currency) {
    parts.push(`Processed ${formatMoney(data.processedAmount, currency)}`)
  }

  if (
    typeof data.authorizedAmount === "number" &&
    typeof data.processedAmount === "number" &&
    data.authorizedAmount !== data.processedAmount &&
    currency
  ) {
    parts.push(`Authorized ${formatMoney(data.authorizedAmount, currency)}`)
  }

  if (typeof data.amount === "number" && currency && !("processedAmount" in data)) {
    parts.push(`Amount ${formatMoney(data.amount, currency)}`)
  }

  if (typeof data.captureType === "string") {
    parts.push(`Capture ${data.captureType}`)
  }

  if (typeof data.paymentCollectionTiming === "string") {
    parts.push(`Timing ${data.paymentCollectionTiming.replaceAll("_", " ").toLowerCase()}`)
  }

  return parts.join(" · ") || null
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

type VendorLinkSource = {
  id: string
  reference: string
  title: string
  kind: TransactionKind | string
  amount: number | null
  depositAmount: number | null
  depositHoldDays?: number | null
  currency: string
  notes: string | null
  updatedAt: Date
  locale?: string
  clientProfile?: {
    fullName: string
    email: string
  } | null
  bulkRecipient?: {
    email: string
  } | null
  link?: {
    id: string
    token: string
    shortCode: string | null
    status: TransactionLinkStatus
    createdAt: Date
    openedAt: Date | null
    completedAt: Date | null
    expiresAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    cancelledBy: string | null
    qrCodeSvg: string | null
  } | null
}

function getLinkLastActivityDate(transaction: VendorLinkSource) {
  const activityDates = [
    transaction.link?.cancelledAt,
    transaction.link?.completedAt,
    transaction.updatedAt,
    transaction.link?.openedAt,
    transaction.link?.createdAt,
  ].filter((value): value is Date => Boolean(value))

  return activityDates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

function getQrUnavailableReason({
  status,
  qrReady,
  qrRemaining,
}: {
  status: TransactionLinkStatus
  qrReady: boolean
  qrRemaining: number | null
}) {
  if (qrReady) {
    return null
  }

  if (!isLiveLinkStatus(status)) {
    return "QR can only be generated for active or processing links."
  }

  if (qrRemaining !== null && qrRemaining <= 0) {
    return "Your current plan has reached its monthly QR code limit. Upgrade to generate more."
  }

  return null
}

export function buildVendorActionsUsage(subscription: VendorSubscription | null): VendorActionsUsageRecord | null {
  if (!subscription) {
    return null
  }

  return {
    planName: subscription.planKey.charAt(0) + subscription.planKey.slice(1).toLowerCase(),
    planSlug: subscription.planKey.toLowerCase(),
    status: subscription.status,
    periodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    isTrial: subscription.status === "TRIALING",
    transactions: {
      used: subscription.transactionsUsed,
      limit: getTransactionLimit(subscription),
      remaining: remainingTransactions(subscription),
    },
    qrCodes: {
      used: subscription.qrCodesUsed,
      limit: getQrCodeLimit(subscription),
      remaining: remainingQrCodes(subscription),
    },
    kyc: {
      used: subscription.kycVerificationsUsed,
      limit: getKycLimit(subscription),
      remaining: remainingKycVerifications(subscription),
      allowed: canUseKyc(subscription),
    },
  }
}

export async function getVendorCreateLinkDialogData(
  email: string | undefined | null
): Promise<VendorCreateLinkDialogData> {
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return {
      contracts: [],
      checklists: [],
    }
  }

  const [contracts, checklists] = await Promise.all([
    safeQuery(
      () =>
        prisma.contractTemplate.findMany({
          where: { vendorId: context.vendorProfile.id },
          orderBy: { name: "asc" },
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.checklistTemplate.findMany({
          where: { vendorId: context.vendorProfile.id },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
      []
    ),
  ])

  return {
    contracts,
    checklists,
  }
}

export function buildVendorLinkRecord(
  transaction: VendorLinkSource,
  options?: { qrRemaining?: number | null }
): VendorLinkRecord {
  const txLocale = (transaction.locale ?? "en").toLowerCase()
  const shareLink = transaction.link?.token ? `${getAppBaseUrl()}/${txLocale}/t/${transaction.link.token}` : ""
  const lastActivity = getLinkLastActivityDate(transaction)
  const status = transaction.link?.status ?? TransactionLinkStatus.ACTIVE
  const qrReady = Boolean(transaction.link?.qrCodeSvg)
  const qrUnavailableReason = getQrUnavailableReason({
    status,
    qrReady,
    qrRemaining: options?.qrRemaining ?? null,
  })

  return {
    id: transaction.link?.id ?? transaction.id,
    transactionId: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? "No email",
    title: transaction.title,
    kind: String(transaction.kind),
    serviceAmount: formatMoney(transaction.amount, transaction.currency),
    depositAmount: formatMoney(transaction.depositAmount, transaction.currency),
    shareLink,
    shortCode: transaction.link?.shortCode ?? "Not set",
    lastActivity: formatDateTime(lastActivity),
    status,
    notes: transaction.notes ?? "",
    expiresAt: transaction.link?.expiresAt?.toISOString() ?? null,
    expiresAtLabel: transaction.link?.expiresAt ? formatDateTime(transaction.link.expiresAt) : "No expiry",
    cancelledAtLabel: transaction.link?.cancelledAt ? formatDateTime(transaction.link.cancelledAt) : null,
    cancelReason: transaction.link?.cancelReason ?? null,
    cancelledBy: transaction.link?.cancelledBy ?? null,
    qrReady,
    qrCodeSvg: transaction.link?.qrCodeSvg ?? null,
    canGenerateQr: !qrReady && qrUnavailableReason === null,
    qrUnavailableReason,
    canEdit: status === TransactionLinkStatus.ACTIVE,
    canCancel: status === TransactionLinkStatus.ACTIVE || status === TransactionLinkStatus.PROCESSING,
  }
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
        include: { vendorProfile: { include: { subscription: true } } },
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
    { label: "Review status", value: args.reviewStatus.replaceAll("_", " "), detail: "Account review", tone: getStatusToneValue(args.reviewStatus) },
    { label: "Payout setup", value: args.stripeConnectionStatus.replaceAll("_", " "), detail: "Payment readiness", tone: getStatusToneValue(args.stripeConnectionStatus) },
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

function createEmptyVendorOverviewFlow(): VendorOverviewFlowRecord {
  return {
    linkSent: 0,
    customerActive: 0,
    kycReady: 0,
    contractReady: 0,
    signed: 0,
    completed: 0,
    disputed: 0,
    cancelled: 0,
  }
}

function buildVendorOverviewFlow(
  groups: Array<{
    status: TransactionStatus
    _count: { _all: number }
  }>
): VendorOverviewFlowRecord {
  const counts = new Map(groups.map((group) => [group.status, group._count._all]))

  return {
    linkSent: counts.get(TransactionStatus.LINK_SENT) ?? 0,
    customerActive:
      (counts.get(TransactionStatus.CUSTOMER_STARTED) ?? 0) +
      (counts.get(TransactionStatus.DOCS_SUBMITTED) ?? 0),
    kycReady: counts.get(TransactionStatus.KYC_VERIFIED) ?? 0,
    contractReady: counts.get(TransactionStatus.CONTRACT_GENERATED) ?? 0,
    signed:
      (counts.get(TransactionStatus.SIGNED) ?? 0) +
      (counts.get(TransactionStatus.PAYMENT_AUTHORIZED) ?? 0),
    completed: counts.get(TransactionStatus.COMPLETED) ?? 0,
    disputed: counts.get(TransactionStatus.DISPUTED) ?? 0,
    cancelled: counts.get(TransactionStatus.CANCELLED) ?? 0,
  }
}

function normalizeSearchTerm(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function buildVendorKycTransactionWhere(
  vendorId: string,
  options: {
    status?: KycStatus
    search?: string
  } = {}
): Prisma.TransactionWhereInput {
  const { status, search } = options

  return {
    vendorId,
    AND: [
      { OR: [{ requiresKyc: true }, { kycVerification: { isNot: null } }] },
      ...(status
        ? status === KycStatus.PENDING
          ? [{ OR: [{ kycVerification: { is: null } }, { kycVerification: { is: { status } } }]}]
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
  bulkRecipient?: { email: string } | null
  requiresKyc: boolean
  kycVerification?: { status: string } | null
  contractTemplateId?: string | null
  signatureRecord?: { status: string } | null
}) {
  return {
    id: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? "No email",
    kind: transaction.kind as string,
    amount: formatMoney(
      transaction.amount != null && transaction.amount > 0 ? transaction.amount : transaction.depositAmount,
      transaction.currency
    ),
    kyc: transaction.requiresKyc ? (transaction.kycVerification?.status ?? "REQUIRED") : "NOT_REQUIRED",
    contract:
      transaction.contractTemplateId != null
        ? transaction.signatureRecord?.status === "SIGNED"
          ? "SIGNED"
          : "ATTACHED"
        : "NOT_REQUIRED",
    status: transaction.status,
    date: formatDate(transaction.createdAt),
  }
}

function createEmptyVendorWorkspace(summary: WorkspaceRecord["summary"]): WorkspaceRecord {
  return {
    summary,
    stats: { totalTransactions: 0, totalClients: 0, activeDeposits: 0, signedContracts: 0, serviceRevenue: 0, depositsCaptured: 0, depositsReleased: 0, depositCaptureCount: 0, depositReleaseCount: 0 },
    subscriptionUsage: null,
    overviewFlow: createEmptyVendorOverviewFlow(),
    overviewActivity: [],
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
  const overviewActivityTypes: TransactionEventType[] = [
    TransactionEventType.LINK_CREATED,
    TransactionEventType.LINK_OPENED,
    TransactionEventType.PROFILE_SUBMITTED,
    TransactionEventType.DOCUMENTS_SUBMITTED,
    TransactionEventType.CUSTOM_FIELDS_SUBMITTED,
    TransactionEventType.KYC_STARTED,
    TransactionEventType.KYC_VERIFIED,
    TransactionEventType.KYC_FAILED,
    TransactionEventType.CONTRACT_REVIEWED,
    TransactionEventType.SIGNATURE_COMPLETED,
    TransactionEventType.SERVICE_PAYMENT_REQUESTED,
    TransactionEventType.SERVICE_PAYMENT_SUCCEEDED,
    TransactionEventType.DEPOSIT_AUTHORIZED,
    TransactionEventType.DEPOSIT_CAPTURED,
    TransactionEventType.DEPOSIT_RELEASED,
    TransactionEventType.DISPUTE_OPENED,
    TransactionEventType.TRANSACTION_CANCELLED,
    TransactionEventType.LINK_CANCELLED,
    TransactionEventType.COMPLETED,
  ]

  const [transactions, contracts, checklists, webhooks, clients,
         totalTransactionCount, totalClientCount, activeDepositCount, signedContractCount,
         serviceRevenueAgg, depositCapturedAgg, depositReleasedAgg,
         transactionStatusGroups, recentActivityEvents, vendorSubscription,
         contractTemplateCount, acceptedInvitationCount, verifiedKycCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.transaction.findMany({
          where: { vendorId },
          include: {
            clientProfile: true,
            bulkRecipient: { select: { email: true } },
            contractTemplate: true,
            kycVerification: true,
            signatureRecord: true,
            contractArtifact: {
              select: {
                signatureImagePublicId: true,
                signatureImageUrl: true,
              },
            },
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
          include: { transaction: { select: { reference: true } } },
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
    safeQuery(() => prisma.transaction.count({ where: { vendorId } }), 0),
    safeQuery(() => prisma.clientProfile.count({ where: { vendorId } }), 0),
    safeQuery(() => prisma.transaction.count({
      where: { vendorId, depositAuthorization: { is: { status: "AUTHORIZED" } } },
    }), 0),
    safeQuery(() => prisma.transaction.count({
      where: { vendorId, signatureRecord: { is: { status: "SIGNED" } } },
    }), 0),
    safeQuery(() => prisma.payment.aggregate({
      _sum: { vendorNetAmount: true },
      _count: { _all: true },
      where: {
        kind: PaymentKind.SERVICE_PAYMENT,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.CAPTURED] },
        transaction: { vendorId },
      },
    }), { _sum: { vendorNetAmount: null }, _count: { _all: 0 } }),
    safeQuery(() => prisma.payment.aggregate({
      _sum: { vendorNetAmount: true },
      _count: { _all: true },
      where: {
        kind: PaymentKind.DEPOSIT_CAPTURE,
        status: PaymentStatus.CAPTURED,
        transaction: { vendorId },
      },
    }), { _sum: { vendorNetAmount: null }, _count: { _all: 0 } }),
    safeQuery(() => prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        kind: PaymentKind.DEPOSIT_RELEASE,
        transaction: { vendorId },
      },
    }), { _sum: { amount: null }, _count: { _all: 0 } }),
    safeQuery(
      () =>
        prisma.transaction.groupBy({
          by: ["status"],
          where: { vendorId },
          _count: { _all: true },
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.transactionEvent.findMany({
          where: {
            transaction: { vendorId },
            type: { in: overviewActivityTypes },
          },
          include: {
            transaction: {
              select: {
                id: true,
                reference: true,
                title: true,
                clientProfile: { select: { fullName: true } },
              },
            },
          },
          orderBy: { occurredAt: "desc" },
          take: 8,
        }),
      []
    ),
    safeQuery(() => prisma.vendorSubscription.findUnique({ where: { vendorId } }), null),
    safeQuery(() => prisma.contractTemplate.count({ where: { vendorId } }), 0),
    safeQuery(() => prisma.invitation.count({ where: { vendorId, status: "ACCEPTED" } }), 0),
    safeQuery(
      () =>
        prisma.transaction.count({
          where: buildVendorKycTransactionWhere(vendorId, { status: KycStatus.VERIFIED }),
        }),
      0
    ),
  ])

  const mappedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    reference: transaction.reference,
    clientName: transaction.clientProfile?.fullName ?? "Client pending",
    clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? "No email",
    kind: transaction.kind as string,
    amount: formatMoney(
      transaction.amount != null && transaction.amount > 0 ? transaction.amount : transaction.depositAmount,
      transaction.currency
    ),
    kyc: transaction.requiresKyc ? (transaction.kycVerification?.status ?? "REQUIRED") : "NOT_REQUIRED",
    contract: transaction.contractTemplate ? (transaction.signatureRecord ? "SIGNED" : "ATTACHED") : "NOT_REQUIRED",
    status: transaction.status,
    date: formatDate(transaction.createdAt),
  }))

  const latestTransactionByClient = new Map<string, string>()
  transactions.forEach((transaction) => {
    if (transaction.clientProfileId && !latestTransactionByClient.has(transaction.clientProfileId)) {
      latestTransactionByClient.set(transaction.clientProfileId, transaction.reference)
    }
  })

  const isActive = vendorSubscription ? hasActiveSubscription(vendorSubscription) : false
  const vendorQrRemaining = remainingQrCodes(vendorSubscription)
  const subscriptionUsage: WorkspaceRecord["subscriptionUsage"] = vendorSubscription
    ? {
        planName: vendorSubscription.planKey.charAt(0) + vendorSubscription.planKey.slice(1).toLowerCase(),
        planSlug: vendorSubscription.planKey.toLowerCase(),
        status: vendorSubscription.status,
        periodEnd: vendorSubscription.currentPeriodEnd?.toISOString() ?? null,
        isTrial: vendorSubscription.status === "TRIALING",
        transactions: {
          used: vendorSubscription.transactionsUsed,
          limit: getTransactionLimit(vendorSubscription),
        },
        eSignatures: {
          used: vendorSubscription.eSignaturesUsed,
          limit: getESignatureLimit(vendorSubscription),
        },
        qrCodes: {
          used: vendorSubscription.qrCodesUsed,
          limit: getQrCodeLimit(vendorSubscription),
        },
        contractTemplates: {
          used: contractTemplateCount,
          limit: getContractTemplateLimit(vendorSubscription),
        },
        kyc: {
          used: verifiedKycCount,
          limit: getKycLimit(vendorSubscription),
          allowed: canUseKyc(vendorSubscription),
        },
        teamUsers: {
          // 1 = vendor owner, plus accepted invitees
          used: 1 + acceptedInvitationCount,
          limit: maxTeamUsers(vendorSubscription),
        },
      }
    : null
  const overviewFlow = {
    ...buildVendorOverviewFlow(transactionStatusGroups),
    kycReady: verifiedKycCount,
  }
  const overviewActivity: WorkspaceRecord["overviewActivity"] = recentActivityEvents.map((event) => ({
    id: event.id,
    type: event.type,
    reference: event.transaction.reference,
    transactionId: event.transaction.id,
    transactionTitle: event.transaction.title,
    clientName: event.transaction.clientProfile?.fullName ?? null,
    occurredAt: event.occurredAt.toISOString(),
  }))

  if (overviewActivity.length < 6) {
    const existingTransactionIds = new Set(overviewActivity.map((item) => item.transactionId))
    const fallbackItems = transactions
      .filter((transaction) => !existingTransactionIds.has(transaction.id))
      .slice(0, 6 - overviewActivity.length)
      .map((transaction) => ({
        id: `fallback-${transaction.id}`,
        type: "TRANSACTION_CREATED" as const,
        reference: transaction.reference,
        transactionId: transaction.id,
        transactionTitle: transaction.title,
        clientName: transaction.clientProfile?.fullName ?? null,
        occurredAt: transaction.createdAt.toISOString(),
      }))

    overviewActivity.push(...fallbackItems)
  }

  return {
    ...createEmptyVendorWorkspace(summary),
    summary,
    stats: {
      totalTransactions: totalTransactionCount,
      totalClients: totalClientCount,
      activeDeposits: activeDepositCount,
      signedContracts: signedContractCount,
      serviceRevenue: serviceRevenueAgg._sum.vendorNetAmount ?? 0,
      depositsCaptured: depositCapturedAgg._sum.vendorNetAmount ?? 0,
      depositsReleased: depositReleasedAgg._sum.amount ?? 0,
      depositCaptureCount: depositCapturedAgg._count._all,
      depositReleaseCount: depositReleasedAgg._count._all,
    },
    subscriptionUsage: isActive ? subscriptionUsage : null,
    overviewFlow,
    overviewActivity,
    alerts: buildVendorAlerts(summary),
    kpis: buildVendorKpis({
      transactionCount: totalTransactionCount,
      clientCount: totalClientCount,
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
        transactionId: transaction.id,
        signer: transaction.signatureRecord?.signerName ?? transaction.clientProfile?.fullName ?? "Client",
        reference: transaction.reference,
        status: transaction.signatureRecord?.status ?? "PENDING",
        template: transaction.contractTemplate?.name ?? "Agreement",
        date: formatDateTime(transaction.signatureRecord?.signedAt ?? transaction.signatureRecord?.createdAt),
        hasSignatureImage: Boolean(
          transaction.contractArtifact?.signatureImagePublicId ??
            transaction.contractArtifact?.signatureImageUrl
        ),
      })),
    deposits: transactions
      .filter((transaction) => transaction.depositAuthorization)
      .map((transaction) => ({
        transactionId: transaction.id,
        client: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        amount: formatMoney(transaction.depositAuthorization?.amount, transaction.depositAuthorization?.currency ?? transaction.currency),
        amountCents: transaction.depositAuthorization?.amount ?? 0,
        currency: transaction.depositAuthorization?.currency ?? transaction.currency,
        status: transaction.depositAuthorization?.status ?? "PENDING",
        date: formatDateTime(
          transaction.depositAuthorization?.capturedAt ??
            transaction.depositAuthorization?.releasedAt ??
            transaction.depositAuthorization?.authorizedAt
        ),
        canManage: transaction.depositAuthorization?.status === PaymentStatus.AUTHORIZED,
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
        transactionId: transaction.id,
        client: transaction.clientProfile?.fullName ?? "Client pending",
        reference: transaction.reference,
        status: transaction.dispute?.status ?? "OPEN",
        summary: transaction.dispute?.summary ?? "Customer issue linked to this workflow.",
      })),
    clients: clients.map((client) => ({
      name: client.fullName,
      email: client.email,
      status: "TRACKED",
      lastTransaction: latestTransactionByClient.get(client.id) ?? null,
    })),
    links: transactions
      .filter((transaction) => transaction.link)
      .map((transaction) =>
        buildVendorLinkRecord({
          id: transaction.id,
          reference: transaction.reference,
          title: transaction.title,
          kind: transaction.kind,
          amount: transaction.amount,
          depositAmount: transaction.depositAmount,
          currency: transaction.currency,
          notes: transaction.notes,
          updatedAt: transaction.updatedAt,
          clientProfile: transaction.clientProfile
            ? {
                fullName: transaction.clientProfile.fullName,
                email: transaction.clientProfile.email,
              }
            : null,
          link: transaction.link
            ? {
                id: transaction.link.id,
                token: transaction.link.token,
                shortCode: transaction.link.shortCode,
                status: transaction.link.status,
                createdAt: transaction.link.createdAt,
                openedAt: transaction.link.openedAt,
                completedAt: transaction.link.completedAt,
                expiresAt: transaction.link.expiresAt,
                cancelledAt: transaction.link.cancelledAt,
                cancelReason: transaction.link.cancelReason,
                cancelledBy: transaction.link.cancelledBy,
                qrCodeSvg: transaction.link.qrCodeSvg,
              }
            : null,
        }, { qrRemaining: vendorQrRemaining })
      ),
    webhooks: webhooks.map((webhook) => ({
      provider: webhook.provider,
      eventType: webhook.eventType,
      status: webhook.status,
      date: formatDateTime(webhook.createdAt),
      reference: webhook.transaction?.reference ?? "Platform event",
      error: webhook.error,
      detail: null,
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
            {
              bulkRecipient: {
                is: {
                  OR: [
                    { email: containsInsensitive(search) },
                    { normalizedEmail: containsInsensitive(search.toLowerCase()) },
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
            bulkRecipient: { select: { email: true } },
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

  const where = buildVendorKycTransactionWhere(context.vendorProfile.id, { status, search })

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
            contractArtifact: {
              select: {
                signatureImagePublicId: true,
                signatureImageUrl: true,
              },
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
      transactionId: transaction.id,
      signer: transaction.signatureRecord?.signerName ?? transaction.clientProfile?.fullName ?? "Client",
      reference: transaction.reference,
      status: transaction.signatureRecord?.status ?? "PENDING",
      template: transaction.contractTemplate?.name ?? "Agreement",
      date: formatDateTime(transaction.signatureRecord?.signedAt ?? transaction.signatureRecord?.createdAt),
      hasSignatureImage: Boolean(
        transaction.contractArtifact?.signatureImagePublicId ??
          transaction.contractArtifact?.signatureImageUrl
      ),
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
      transactionId: transaction.id,
      client: transaction.clientProfile?.fullName ?? "Client pending",
      reference: transaction.reference,
      amount: formatMoney(
        transaction.depositAuthorization?.amount,
        transaction.depositAuthorization?.currency ?? transaction.currency
      ),
      amountCents: transaction.depositAuthorization?.amount ?? 0,
      currency: transaction.depositAuthorization?.currency ?? transaction.currency,
      status: transaction.depositAuthorization?.status ?? "PENDING",
      date: formatDateTime(
        transaction.depositAuthorization?.capturedAt ??
          transaction.depositAuthorization?.releasedAt ??
          transaction.depositAuthorization?.authorizedAt
      ),
      canManage: transaction.depositAuthorization?.status === PaymentStatus.AUTHORIZED,
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
      transactionId: transaction.id,
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

export type VendorDisputeDetailRecord = {
  transactionId: string
  disputeId: string
  reference: string
  title: string
  clientName: string
  depositAmount: string
  depositCents: number
  currency: string
  status: string
  summary: string
  openedAt: string
  resolvedAt: string | null
  resolution: string | null
  signedAgreementUrl: string | null
  evidenceAssets: VendorDisputeEvidenceAsset[]
  history: { eventType: string | null; title: string; detail: string | null; occurredAt: string; pending: boolean }[]
}

export async function getVendorDisputeDetail(
  email: string | undefined | null,
  transactionId: string
): Promise<VendorDisputeDetailRecord | null> {
  const context = await getVendorContextByEmail(email)
  if (!context) return null

  const transaction = await safeQuery(
    () =>
      prisma.transaction.findFirst({
        where: { id: transactionId, vendorId: context.vendorProfile.id },
        include: {
          dispute: true,
          depositAuthorization: { select: { amount: true, currency: true } },
          clientProfile: { select: { fullName: true } },
          contractArtifact: { select: { signedPdfPublicId: true } },
          events: { orderBy: { occurredAt: "asc" } },
        },
      }),
    null
  )

  if (!transaction || !transaction.dispute) return null

  const d = transaction.dispute
  const isPending = d.status === "OPEN" || d.status === "UNDER_REVIEW"

  const signedPdfPublicId = transaction.contractArtifact?.signedPdfPublicId
  // Build download URL for the signed PDF via Cloudinary proxy
  const signedAgreementUrl = signedPdfPublicId
    ? `${getAppBaseUrl()}/api/integrations/cloudinary/download?publicId=${encodeURIComponent(signedPdfPublicId)}&resourceType=raw&format=pdf&fileName=${encodeURIComponent(`${transaction.reference}-signed.pdf`)}`
    : null

  const evidenceAssets = parseDisputeEvidenceAssets(d.evidenceImages).map(buildVendorDisputeEvidenceAsset)

  return {
    transactionId: transaction.id,
    disputeId: d.id,
    reference: transaction.reference,
    title: transaction.title,
    clientName: transaction.clientProfile?.fullName ?? "Unknown client",
    depositAmount: formatMoney(transaction.depositAuthorization?.amount, transaction.depositAuthorization?.currency),
    depositCents: transaction.depositAuthorization?.amount ?? 0,
    currency: transaction.depositAuthorization?.currency ?? "EUR",
    status: d.status,
    summary: d.summary,
    openedAt: formatDate(d.openedAt),
    resolvedAt: d.resolvedAt ? formatDate(d.resolvedAt) : null,
    resolution: d.resolution ?? null,
    signedAgreementUrl,
    evidenceAssets,
    history: [
      ...transaction.events.map((ev) => ({
        eventType: ev.type as string,
        title: ev.title,
        detail: ev.detail ?? null,
        occurredAt: formatDateTime(ev.occurredAt),
        pending: false,
      })),
      ...(isPending
        ? [{ eventType: "PENDING", title: "⏳ Decision pending", detail: `Deadline: ${formatDate(disputeDeadline(d.openedAt))}`, occurredAt: "", pending: true }]
        : []),
    ],
  }
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
      status: "TRACKED",
      lastTransaction: latestTransactionByClient.get(client.id) ?? null,
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
  const state = normalizeFilterOptionValue(filters.state, vendorLinkStateOptions) as TransactionLinkStatus | undefined
  const kind = normalizeFilterOptionValue(filters.kind, vendorTransactionKindOptions) as TransactionKind | undefined
  const linkFilter: Prisma.TransactionLinkNullableScalarRelationFilter = state ? { is: { status: state } } : { isNot: null }

  const where: Prisma.TransactionWhereInput = {
    vendorId: context.vendorProfile.id,
    link: linkFilter,
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
            {
              bulkRecipient: {
                is: {
                  OR: [
                    { email: containsInsensitive(search) },
                    { normalizedEmail: containsInsensitive(search.toLowerCase()) },
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
            clientProfile: { select: { fullName: true, email: true } },
            bulkRecipient: { select: { email: true } },
            link: {
              select: {
                id: true,
                token: true,
                shortCode: true,
                status: true,
                createdAt: true,
                openedAt: true,
                completedAt: true,
                expiresAt: true,
                cancelledAt: true,
                cancelReason: true,
                cancelledBy: true,
                qrCodeSvg: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.transaction.count({ where }), 0),
  ])

  const qrRemaining = remainingQrCodes(context.vendorProfile.subscription ?? null)

  return buildPaginatedResult(
    transactions.map((transaction) =>
      buildVendorLinkRecord({
        id: transaction.id,
        reference: transaction.reference,
        title: transaction.title,
        kind: transaction.kind,
        amount: transaction.amount,
        depositAmount: transaction.depositAmount,
        currency: transaction.currency,
        notes: transaction.notes,
        updatedAt: transaction.updatedAt,
        clientProfile: transaction.clientProfile,
        bulkRecipient: transaction.bulkRecipient,
        link: transaction.link,
      }, { qrRemaining })
    ),
    totalCount,
    pagination.page,
    pagination.pageSize
  )
}

export async function getVendorRecentLinksData(
  email: string | undefined | null,
  limit = 6
): Promise<VendorLinkRecord[]> {
  const context = await getVendorContextByEmail(email)

  if (!context) {
    return []
  }

  const transactions = await safeQuery(
    () =>
      prisma.transaction.findMany({
        where: {
          vendorId: context.vendorProfile.id,
          link: {
            is: {
              status: {
                in: [TransactionLinkStatus.ACTIVE, TransactionLinkStatus.PROCESSING],
              },
            },
          },
        },
        include: {
          clientProfile: { select: { fullName: true, email: true } },
          bulkRecipient: { select: { email: true } },
          link: {
            select: {
              id: true,
              token: true,
              shortCode: true,
              status: true,
              createdAt: true,
              openedAt: true,
              completedAt: true,
              expiresAt: true,
              cancelledAt: true,
              cancelReason: true,
              cancelledBy: true,
              qrCodeSvg: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    []
  )

  const qrRemaining = remainingQrCodes(context.vendorProfile.subscription ?? null)

  return transactions.map((transaction) =>
    buildVendorLinkRecord({
      id: transaction.id,
      reference: transaction.reference,
      title: transaction.title,
      kind: transaction.kind,
      amount: transaction.amount,
      depositAmount: transaction.depositAmount,
      currency: transaction.currency,
      notes: transaction.notes,
      updatedAt: transaction.updatedAt,
      clientProfile: transaction.clientProfile,
      bulkRecipient: transaction.bulkRecipient,
      link: transaction.link,
    }, { qrRemaining })
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
  const webhookWhere: Prisma.WebhookEventWhereInput = {
    vendorId: context.vendorProfile.id,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { provider: containsInsensitive(search) },
            { eventType: containsInsensitive(search) },
            { providerEventId: containsInsensitive(search) },
            { transaction: { is: { reference: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }
  const vendorEventHistoryTypes: TransactionEventType[] = [
    TransactionEventType.WEBHOOK_PROCESSED,
    TransactionEventType.DISPUTE_OPENED,
    TransactionEventType.DEPOSIT_CAPTURED,
    TransactionEventType.DEPOSIT_RELEASED,
  ]

  const transactionEventWhere: Prisma.TransactionEventWhereInput | undefined =
    status && status !== WebhookStatus.PROCESSED
      ? undefined
      : {
          type: { in: vendorEventHistoryTypes },
          transaction: { vendorId: context.vendorProfile.id },
          ...(search
            ? {
                OR: [
                  { title: containsInsensitive(search) },
                  { detail: containsInsensitive(search) },
                  { transaction: { reference: containsInsensitive(search) } },
                ],
              }
            : {}),
        }

  const takeForMerge = pagination.skip + pagination.pageSize

  const [webhooks, transactionEvents, webhookCount, transactionEventCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.webhookEvent.findMany({
          where: webhookWhere,
          include: { transaction: { select: { reference: true } } },
          orderBy: { createdAt: "desc" },
          take: takeForMerge,
        }),
      []
    ),
    transactionEventWhere === undefined
      ? Promise.resolve([])
      : safeQuery(
          () =>
            prisma.transactionEvent.findMany({
              where: transactionEventWhere,
              include: { transaction: { select: { reference: true } } },
              orderBy: { occurredAt: "desc" },
              take: takeForMerge,
            }),
          []
        ),
    safeQuery(() => prisma.webhookEvent.count({ where: webhookWhere }), 0),
    transactionEventWhere === undefined
      ? Promise.resolve(0)
      : safeQuery(() => prisma.transactionEvent.count({ where: transactionEventWhere }), 0),
  ])

  const items = [
    ...webhooks.map((webhook) => ({
      provider: webhook.provider,
      eventType: webhook.eventType,
      status: webhook.status,
      date: formatDateTime(webhook.createdAt),
      reference: webhook.transaction?.reference ?? "Platform event",
      error: webhook.error,
      detail: null,
      createdAt: webhook.createdAt,
    })),
    ...transactionEvents.map((event) => ({
      provider: event.type === TransactionEventType.WEBHOOK_PROCESSED ? "stripe" : "platform",
      eventType: event.title,
      status: WebhookStatus.PROCESSED,
      date: formatDateTime(event.occurredAt),
      reference: event.transaction.reference,
      error: null,
      detail: event.detail,
      createdAt: event.occurredAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(pagination.skip, pagination.skip + pagination.pageSize)
    .map(({ provider, eventType, status, date, reference, error, detail }) => ({
      provider,
      eventType,
      status,
      date,
      reference,
      error,
      detail,
    }))

  return buildPaginatedResult(
    items,
    webhookCount + transactionEventCount,
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
          ownerFirstName: user.vendorProfile.ownerFirstName ?? "",
          ownerLastName: user.vendorProfile.ownerLastName ?? "",
          businessName: user.vendorProfile.businessName ?? "",
          businessEmail: user.vendorProfile.businessEmail ?? user.email,
          supportEmail: user.vendorProfile.supportEmail ?? "",
          businessPhone: user.vendorProfile.businessPhone ?? "",
          businessAddress: user.vendorProfile.businessAddress ?? "",
          businessCountry: user.vendorProfile.businessCountry ?? "",
          registrationNumber: user.vendorProfile.registrationNumber ?? "",
          vatNumber: user.vendorProfile.vatNumber ?? "",
          preferredLocale: user.vendorProfile.preferredLocale,
          reviewStatus: user.vendorProfile.reviewStatus,
          stripeConnectionStatus: user.vendorProfile.stripeConnectionStatus,
          profileCompletion: getProfileCompletion(user.vendorProfile),
          transactionCount: user.vendorProfile._count.transactions,
          clientCount: user.vendorProfile._count.clients,
        }
      : null,
  }
}

// ── Admin Vendor Profile (link-first tree for /admin/users/[userId]) ───────

export type AdminVendorPaymentRecord = {
  id: string
  status: string
  amount: number
  currency: string
  stripeIntentId: string | null
  stripeFeeAmount: number
  platformFeeAmount: number
  vendorNetAmount: number
  processedAt: string | null
}

export type AdminVendorDepositAuthRecord = {
  status: string
  amount: number
  currency: string
  stripeIntentId: string | null
  authorizedAt: string | null
  capturedAt: string | null
  releasedAt: string | null
}

export type AdminVendorEventRecord = {
  id: string
  type: string
  title: string
  detail: string | null
  timestamp: string
  occurredAt: string
}

export type AdminVendorAuditRecord = {
  id: string
  action: string
  actor: string
  actorType: string
  timestamp: string
  createdAt: string
  metadataSummary: string | null
}

export type AdminVendorLinkListRecord = {
  id: string
  transactionId: string
  reference: string
  title: string
  linkStatus: string
  transactionStatus: string
  shortCode: string | null
  locale: string
  clientName: string | null
  clientEmail: string | null
  amount: number | null
  depositAmount: number | null
  currency: string
  documentCount: number
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export type AdminVendorLinksFilterInput = {
  q?: string | null
  linkStatus?: string | null
  transactionStatus?: string | null
  kind?: string | null
}

export type AdminVendorLinksFilters = {
  q: string
  linkStatus: TransactionLinkStatus | null
  transactionStatus: TransactionStatus | null
  kind: TransactionKind | null
}

export type AdminVendorLinkDocumentRecord = {
  id: string
  label: string
  type: string
  fileName: string | null
  assetUrl: string | null
  textValue: string | null
  publicId: string | null
  uploadedAt: string
  requirementId: string | null
  requirementLabel: string | null
  requirementRequired: boolean
}

export type AdminVendorLinkRequirementRecord = {
  id: string
  label: string
  type: string
  required: boolean
  instructions: string | null
}

export type AdminVendorLinkDetailRecord = {
  id: string
  transactionId: string
  token: string
  shortCode: string | null
  status: string
  createdAt: string
  openedAt: string | null
  expiresAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  cancelledBy: string | null
  reference: string
  title: string
  kind: string
  transactionStatus: string
  paymentCollectionTiming: string
  currency: string
  amount: number | null
  depositAmount: number | null
  notes: string | null
  locale: string
  requiresKyc: boolean
  requireClientCompany: boolean
  servicePaymentRequestedAt: string | null
  customerCompletedAt: string | null
  createdAtLabel: string
  updatedAt: string
  client: {
    fullName: string
    email: string
    phone: string | null
    companyName: string | null
    address: string | null
    country: string | null
  } | null
  documentSummary: {
    submittedCount: number
    requiredCount: number
    submittedRequiredCount: number
  }
  requirements: AdminVendorLinkRequirementRecord[]
  documents: AdminVendorLinkDocumentRecord[]
  kyc: {
    provider: string
    status: string
    summary: string | null
    verifiedAt: string | null
    createdAt: string
  } | null
  signature: {
    status: string
    signerName: string | null
    signedAt: string | null
  } | null
  contract: {
    sourceTemplateName: string | null
    generatedAt: string
    reviewCompletedAt: string | null
    signedPdfUrl: string | null
    signedPdfHash: string | null
    signedAt: string | null
  } | null
  dispute: { id: string; status: string } | null
  servicePayment: AdminVendorPaymentRecord | null
  depositAuth: AdminVendorDepositAuthRecord | null
  depositCapture: AdminVendorPaymentRecord | null
  depositRelease: AdminVendorPaymentRecord | null
  events: AdminVendorEventRecord[]
  auditLogs: AdminVendorAuditRecord[]
}

export type AdminVendorLinksPageRecord = PaginationMeta & {
  records: AdminVendorLinkListRecord[]
  filters: AdminVendorLinksFilters
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type AdminVendorSubscriptionRecord = {
  planKey: string
  billingInterval: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialStart: string | null
  trialEnd: string | null
  transactionsUsed: number
  eSignaturesUsed: number
  kycVerificationsUsed: number
  qrCodesUsed: number
  smsWhatsappUsed: number
  teamUsersUsed: number
}

export type AdminVendorProfileRecord = {
  user: AdminUserDetailRecord
  subscription: AdminVendorSubscriptionRecord | null
  links: AdminVendorLinksPageRecord | null
  selectedLink: AdminVendorLinkDetailRecord | null
}

export async function getAdminVendorProfile(
  userId: string,
  options: {
    activeTab?: "overview" | "transactions" | "subscription" | "access"
    linksPage?: string | number | null
    linksPageSize?: string | number | null
    linksFilters?: AdminVendorLinksFilterInput
    selectedLinkId?: string | null
    includeLinksList?: boolean
    includeSelectedLink?: boolean
  } = {}
): Promise<AdminVendorProfileRecord | null> {
  const raw = await safeQuery(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          vendorProfile: {
            include: {
              _count: { select: { transactions: true, clients: true } },
              subscription: true,
            },
          },
        },
      }),
    null
  )

  if (!raw) return null

  const user: AdminUserDetailRecord = {
    id: raw.id,
    name: raw.name ?? "Unnamed user",
    email: raw.email,
    role: raw.role,
    company: raw.vendorProfile?.businessName ?? "Conntrazy",
    status: raw.vendorProfile?.reviewStatus ?? "Active",
    emailVerified: raw.emailVerified ? formatDateTime(raw.emailVerified) : null,
    joinedAt: formatDateTime(raw.createdAt),
    vendorProfile: raw.vendorProfile
      ? {
          id: raw.vendorProfile.id,
          ownerFirstName: raw.vendorProfile.ownerFirstName ?? "",
          ownerLastName: raw.vendorProfile.ownerLastName ?? "",
          businessName: raw.vendorProfile.businessName ?? "",
          businessEmail: raw.vendorProfile.businessEmail ?? raw.email,
          supportEmail: raw.vendorProfile.supportEmail ?? "",
          businessPhone: raw.vendorProfile.businessPhone ?? "",
          businessAddress: raw.vendorProfile.businessAddress ?? "",
          businessCountry: raw.vendorProfile.businessCountry ?? "",
          registrationNumber: raw.vendorProfile.registrationNumber ?? "",
          vatNumber: raw.vendorProfile.vatNumber ?? "",
          preferredLocale: raw.vendorProfile.preferredLocale,
          reviewStatus: raw.vendorProfile.reviewStatus,
          stripeConnectionStatus: raw.vendorProfile.stripeConnectionStatus,
          profileCompletion: getProfileCompletion(raw.vendorProfile),
          transactionCount: raw.vendorProfile._count.transactions,
          clientCount: raw.vendorProfile._count.clients,
        }
      : null,
  }

  const sub = raw.vendorProfile?.subscription ?? null
  const subscription: AdminVendorSubscriptionRecord | null = sub
    ? {
        planKey: sub.planKey,
        billingInterval: sub.billingInterval,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart ? formatDate(sub.currentPeriodStart) : null,
        currentPeriodEnd: sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        trialStart: sub.trialStart ? formatDate(sub.trialStart) : null,
        trialEnd: sub.trialEnd ? formatDate(sub.trialEnd) : null,
        transactionsUsed: sub.transactionsUsed,
        eSignaturesUsed: sub.eSignaturesUsed,
        kycVerificationsUsed: sub.kycVerificationsUsed,
        qrCodesUsed: sub.qrCodesUsed,
        smsWhatsappUsed: sub.smsWhatsappUsed,
        teamUsersUsed: sub.teamUsersUsed,
      }
    : null

  const includeLinksList = options.includeLinksList ?? options.activeTab === "transactions"
  const includeSelectedLink = options.includeSelectedLink ?? Boolean(options.selectedLinkId)

  if (
    !raw.vendorProfile ||
    options.activeTab !== "transactions" ||
    (!includeLinksList && !includeSelectedLink)
  ) {
    return {
      user,
      subscription,
      links: null,
      selectedLink: null,
    }
  }

  const links: AdminVendorLinksPageRecord | null = includeLinksList
    ? await getAdminVendorLinksPage(raw.vendorProfile.id, {
        page: options.linksPage,
        pageSize: options.linksPageSize,
        filters: options.linksFilters,
      })
    : null

  const selectedLinkId = includeSelectedLink ? (options.selectedLinkId ?? null) : null

  if (!selectedLinkId) {
    return {
      user,
      subscription,
      links,
      selectedLink: null,
    }
  }

  const selectedRaw = await safeQuery(
    () =>
      prisma.transactionLink.findFirst({
        where: {
          id: selectedLinkId,
          transaction: {
            vendorId: raw.vendorProfile!.id,
          },
        },
        include: {
          transaction: {
            include: {
              clientProfile: {
                select: {
                  fullName: true,
                  email: true,
                  phone: true,
                  companyName: true,
                  address: true,
                  country: true,
                },
              },
              requirements: {
                orderBy: { sortOrder: "asc" },
              },
              documents: {
                include: {
                  requirement: {
                    select: {
                      id: true,
                      label: true,
                      required: true,
                    },
                  },
                },
                orderBy: { uploadedAt: "asc" },
              },
              payments: true,
              depositAuthorization: true,
              kycVerification: {
                select: {
                  provider: true,
                  status: true,
                  summary: true,
                  verifiedAt: true,
                  createdAt: true,
                },
              },
              signatureRecord: {
                select: {
                  status: true,
                  signerName: true,
                  signedAt: true,
                },
              },
              contractArtifact: {
                select: {
                  sourceTemplateName: true,
                  generatedAt: true,
                  reviewCompletedAt: true,
                  signedPdfUrl: true,
                  signedPdfHash: true,
                  signedAt: true,
                },
              },
              dispute: {
                select: {
                  id: true,
                  status: true,
                },
              },
              events: {
                orderBy: { occurredAt: "asc" },
              },
            },
          },
        },
      }),
    null
  )

  if (!selectedRaw) {
    return {
      user,
      subscription,
      links,
      selectedLink: null,
    }
  }

  const selectedAuditLogs = await safeQuery(
    () =>
      prisma.auditLog.findMany({
        where: {
          entityType: "Transaction",
          entityId: selectedRaw.transactionId,
        },
        include: {
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    []
  )

  const tx = selectedRaw.transaction
  const servicePayment = tx.payments.find((payment) => payment.kind === PaymentKind.SERVICE_PAYMENT) ?? null
  const depositCapture = tx.payments.find((payment) => payment.kind === PaymentKind.DEPOSIT_CAPTURE) ?? null
  const depositRelease = tx.payments.find((payment) => payment.kind === PaymentKind.DEPOSIT_RELEASE) ?? null
  const requiredRequirements = tx.requirements.filter((requirement) => requirement.required)
  const submittedRequiredCount = requiredRequirements.filter((requirement) =>
    isRequirementSlotSatisfied(requirement, tx.documents)
  ).length

  const selectedLink: AdminVendorLinkDetailRecord = {
    id: selectedRaw.id,
    transactionId: selectedRaw.transactionId,
    token: selectedRaw.token,
    shortCode: selectedRaw.shortCode ?? null,
    status: selectedRaw.status,
    createdAt: formatDateTime(selectedRaw.createdAt),
    openedAt: selectedRaw.openedAt ? formatDateTime(selectedRaw.openedAt) : null,
    expiresAt: selectedRaw.expiresAt ? formatDateTime(selectedRaw.expiresAt) : null,
    completedAt: selectedRaw.completedAt ? formatDateTime(selectedRaw.completedAt) : null,
    cancelledAt: selectedRaw.cancelledAt ? formatDateTime(selectedRaw.cancelledAt) : null,
    cancelReason: selectedRaw.cancelReason ?? null,
    cancelledBy: selectedRaw.cancelledBy ?? null,
    reference: tx.reference,
    title: tx.title,
    kind: tx.kind,
    transactionStatus: tx.status,
    paymentCollectionTiming: tx.paymentCollectionTiming,
    currency: tx.currency,
    amount: tx.amount ?? null,
    depositAmount: tx.depositAmount ?? null,
    notes: tx.notes ?? null,
    locale: tx.locale,
    requiresKyc: tx.requiresKyc,
    requireClientCompany: tx.requireClientCompany,
    servicePaymentRequestedAt: tx.servicePaymentRequestedAt ? formatDateTime(tx.servicePaymentRequestedAt) : null,
    customerCompletedAt: tx.customerCompletedAt ? formatDateTime(tx.customerCompletedAt) : null,
    createdAtLabel: formatDateTime(tx.createdAt),
    updatedAt: formatDateTime(tx.updatedAt),
    client: tx.clientProfile
      ? {
          fullName: tx.clientProfile.fullName,
          email: tx.clientProfile.email,
          phone: tx.clientProfile.phone ?? null,
          companyName: tx.clientProfile.companyName ?? null,
          address: tx.clientProfile.address ?? null,
          country: tx.clientProfile.country ?? null,
        }
      : null,
    documentSummary: {
      submittedCount: tx.documents.length,
      requiredCount: requiredRequirements.length,
      submittedRequiredCount,
    },
    requirements: tx.requirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      type: requirement.type,
      required: requirement.required,
      instructions: requirement.instructions ?? null,
    })),
    documents: tx.documents.map((document) => ({
      id: document.id,
      label: document.label,
      type: document.type,
      fileName: document.fileName ?? null,
      assetUrl: document.assetUrl ?? null,
      textValue: document.textValue ?? null,
      publicId: document.publicId ?? null,
      uploadedAt: formatDateTime(document.uploadedAt),
      requirementId: document.requirementId ?? null,
      requirementLabel: document.requirement?.label ?? null,
      requirementRequired: document.requirement?.required ?? false,
    })),
    kyc: tx.kycVerification
      ? {
          provider: tx.kycVerification.provider,
          status: tx.kycVerification.status,
          summary: tx.kycVerification.summary ?? null,
          verifiedAt: tx.kycVerification.verifiedAt ? formatDateTime(tx.kycVerification.verifiedAt) : null,
          createdAt: formatDateTime(tx.kycVerification.createdAt),
        }
      : null,
    signature: tx.signatureRecord
      ? {
          status: tx.signatureRecord.status,
          signerName: tx.signatureRecord.signerName ?? null,
          signedAt: tx.signatureRecord.signedAt ? formatDateTime(tx.signatureRecord.signedAt) : null,
        }
      : null,
    contract: tx.contractArtifact
      ? {
          sourceTemplateName: tx.contractArtifact.sourceTemplateName ?? null,
          generatedAt: formatDateTime(tx.contractArtifact.generatedAt),
          reviewCompletedAt: tx.contractArtifact.reviewCompletedAt
            ? formatDateTime(tx.contractArtifact.reviewCompletedAt)
            : null,
          signedPdfUrl: tx.contractArtifact.signedPdfUrl ?? null,
          signedPdfHash: tx.contractArtifact.signedPdfHash ?? null,
          signedAt: tx.contractArtifact.signedAt ? formatDateTime(tx.contractArtifact.signedAt) : null,
        }
      : null,
    dispute: tx.dispute ? { id: tx.dispute.id, status: tx.dispute.status } : null,
    servicePayment: servicePayment
      ? {
          id: servicePayment.id,
          status: servicePayment.status,
          amount: servicePayment.amount,
          currency: servicePayment.currency,
          stripeIntentId: servicePayment.stripeIntentId ?? null,
          stripeFeeAmount: servicePayment.stripeFeeAmount ?? 0,
          platformFeeAmount: servicePayment.platformFeeAmount ?? 0,
          vendorNetAmount: servicePayment.vendorNetAmount ?? servicePayment.amount,
          processedAt: servicePayment.processedAt ? formatDateTime(servicePayment.processedAt) : null,
        }
      : null,
    depositAuth: tx.depositAuthorization
      ? {
          status: tx.depositAuthorization.status,
          amount: tx.depositAuthorization.amount,
          currency: tx.depositAuthorization.currency,
          stripeIntentId: tx.depositAuthorization.stripeIntentId ?? null,
          authorizedAt: tx.depositAuthorization.authorizedAt
            ? formatDateTime(tx.depositAuthorization.authorizedAt)
            : null,
          capturedAt: tx.depositAuthorization.capturedAt
            ? formatDateTime(tx.depositAuthorization.capturedAt)
            : null,
          releasedAt: tx.depositAuthorization.releasedAt
            ? formatDateTime(tx.depositAuthorization.releasedAt)
            : null,
        }
      : null,
    depositCapture: depositCapture
      ? {
          id: depositCapture.id,
          status: depositCapture.status,
          amount: depositCapture.amount,
          currency: depositCapture.currency,
          stripeIntentId: depositCapture.stripeIntentId ?? null,
          stripeFeeAmount: depositCapture.stripeFeeAmount ?? 0,
          platformFeeAmount: depositCapture.platformFeeAmount ?? 0,
          vendorNetAmount: depositCapture.vendorNetAmount ?? depositCapture.amount,
          processedAt: depositCapture.processedAt ? formatDateTime(depositCapture.processedAt) : null,
        }
      : null,
    depositRelease: depositRelease
      ? {
          id: depositRelease.id,
          status: depositRelease.status,
          amount: depositRelease.amount,
          currency: depositRelease.currency,
          stripeIntentId: depositRelease.stripeIntentId ?? null,
          stripeFeeAmount: depositRelease.stripeFeeAmount ?? 0,
          platformFeeAmount: depositRelease.platformFeeAmount ?? 0,
          vendorNetAmount: depositRelease.vendorNetAmount ?? depositRelease.amount,
          processedAt: depositRelease.processedAt ? formatDateTime(depositRelease.processedAt) : null,
        }
      : null,
    events: tx.events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      detail: event.detail ?? null,
      timestamp: event.occurredAt.toISOString(),
      occurredAt: formatDateTime(event.occurredAt),
    })),
    auditLogs: selectedAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor?.name ?? log.actor?.email ?? "System",
      actorType: log.actorType,
      timestamp: log.createdAt.toISOString(),
      createdAt: formatDateTime(log.createdAt),
      metadataSummary: formatAuditMetadataSummary(log.metadata),
    })),
  }

  return { user, subscription, links, selectedLink }
}

export async function getAdminVendorLinksPage(
  vendorId: string,
  options: {
    page?: string | number | null
    pageSize?: string | number | null
    filters?: AdminVendorLinksFilterInput
  } = {}
): Promise<AdminVendorLinksPageRecord> {
  const pagination = resolvePagination(
    { page: options.page, pageSize: options.pageSize },
    { defaultPageSize: 12, maxPageSize: 100 }
  )

  const normalizedSearch = normalizeSearchTerm(options.filters?.q)
  const search = normalizedSearch ? normalizedSearch.slice(0, 120) : undefined
  const linkStatus = normalizeFilterOptionValue(
    options.filters?.linkStatus,
    vendorLinkStateOptions
  ) as TransactionLinkStatus | undefined
  const transactionStatus = normalizeFilterOptionValue(
    options.filters?.transactionStatus,
    vendorTransactionStatusOptions
  ) as TransactionStatus | undefined
  const kind = normalizeFilterOptionValue(options.filters?.kind, vendorTransactionKindOptions) as
    | TransactionKind
    | undefined

  const where: Prisma.TransactionWhereInput = {
    vendorId,
    link: linkStatus ? { is: { status: linkStatus } } : { isNot: null },
    ...(transactionStatus ? { status: transactionStatus } : {}),
    ...(kind ? { kind } : {}),
    ...(search
      ? {
          OR: [
            { reference: containsInsensitive(search) },
            { title: containsInsensitive(search) },
            { link: { is: { shortCode: containsInsensitive(search) } } },
            {
              clientProfile: {
                is: {
                  OR: [
                    { fullName: containsInsensitive(search) },
                    { email: containsInsensitive(search) },
                    { companyName: containsInsensitive(search) },
                  ],
                },
              },
            },
            {
              bulkRecipient: {
                is: {
                  OR: [
                    { email: containsInsensitive(search) },
                    { normalizedEmail: containsInsensitive(search.toLowerCase()) },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const totalCount = await safeQuery(() => prisma.transaction.count({ where }), 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize))
  const page = Math.min(pagination.page, totalPages)
  const skip = (page - 1) * pagination.pageSize

  const transactions =
    totalCount === 0
      ? []
      : await safeQuery(
          () =>
            prisma.transaction.findMany({
              where,
              include: {
                clientProfile: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
                bulkRecipient: {
                  select: {
                    email: true,
                  },
                },
                link: {
                  select: {
                    id: true,
                    shortCode: true,
                    status: true,
                    createdAt: true,
                    openedAt: true,
                    completedAt: true,
                    cancelledAt: true,
                  },
                },
                _count: {
                  select: {
                    documents: true,
                  },
                },
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              skip,
              take: pagination.pageSize,
            }),
          []
        )

  const records = transactions.flatMap((transaction) => {
    if (!transaction.link) {
      return []
    }

    const lastActivityAt =
      transaction.link.completedAt ??
      transaction.link.cancelledAt ??
      transaction.link.openedAt ??
      transaction.updatedAt

    return [
      {
        id: transaction.link.id,
        transactionId: transaction.id,
        reference: transaction.reference,
        title: transaction.title,
        linkStatus: transaction.link.status,
        transactionStatus: transaction.status,
        shortCode: transaction.link.shortCode ?? null,
        locale: transaction.locale,
        clientName: transaction.clientProfile?.fullName ?? null,
        clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? null,
        amount: transaction.amount ?? null,
        depositAmount: transaction.depositAmount ?? null,
        currency: transaction.currency,
        documentCount: transaction._count.documents,
        createdAt: formatDateTime(transaction.link.createdAt),
        updatedAt: formatDateTime(transaction.updatedAt),
        lastActivityAt: formatDateTime(lastActivityAt),
      },
    ]
  })

  return {
    records,
    filters: {
      q: search ?? "",
      linkStatus: linkStatus ?? null,
      transactionStatus: transactionStatus ?? null,
      kind: kind ?? null,
    },
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    ...buildPaginationMeta(totalCount, page, pagination.pageSize),
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

// ── Admin Disputes ────────────────────────────────────────────────────────────

export type AdminDisputeRecord = {
  id: string
  transactionId: string
  reference: string
  title: string
  vendorId: string
  vendorName: string
  vendorEmail: string
  clientName: string
  clientEmail: string
  depositAmount: string
  depositCents: number
  currency: string
  status: string
  summary: string
  openedAt: string
  resolvedAt: string | null
  resolution: string | null
  deadlineAt: string
  attachmentCount: number
}

export type AdminDisputeDetailRecord = AdminDisputeRecord & {
  vendorStripeAccountId: string | null
  stripeIntentId: string | null
  transactionKind: string
  serviceAmount: string
  documents: {
    id: string
    label: string
    type: string
    fileName: string | null
    assetUrl: string | null
    textValue: string | null
    uploadedAt: string
  }[]
  history: {
    title: string
    detail: string | null
    occurredAt: string
    pending: boolean
  }[]
}

export type AdminDisputeListData = {
  kpis: SummaryKpi[]
  disputes: AdminDisputeRecord[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

type AdminDisputeFilters = {
  q?: string
  status?: string
}

function disputeDeadline(openedAt: Date) {
  const d = new Date(openedAt)
  d.setDate(d.getDate() + 7)
  return d
}

export async function getAdminDisputes(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminDisputeFilters = {}
): Promise<AdminDisputeListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const status = normalizeFilterOptionValue(filters.status, vendorDisputeStatusOptions) as DisputeStatus | undefined

  const where: Prisma.DisputeWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { transaction: { reference: containsInsensitive(search) } },
            { transaction: { title: containsInsensitive(search) } },
            { transaction: { clientProfile: { fullName: containsInsensitive(search) } } },
            { transaction: { clientProfile: { email: containsInsensitive(search) } } },
            { transaction: { vendor: { businessName: containsInsensitive(search) } } },
          ],
        }
      : {}),
  }

  const [disputes, totalCount, openCount, reviewCount, resolvedCount, lostCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.dispute.findMany({
          where,
          include: {
            transaction: {
              include: {
                vendor: { select: { id: true, businessName: true, businessEmail: true } },
                clientProfile: { select: { fullName: true, email: true } },
                depositAuthorization: { select: { amount: true, currency: true } },
                documents: { select: { id: true } },
              },
            },
          },
          orderBy: { openedAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.dispute.count({ where }), 0),
    safeQuery(() => prisma.dispute.count({ where: { status: "OPEN" } }), 0),
    safeQuery(() => prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }), 0),
    safeQuery(() => prisma.dispute.count({ where: { status: "RESOLVED" } }), 0),
    safeQuery(() => prisma.dispute.count({ where: { status: "LOST" } }), 0),
  ])

  const kpis: SummaryKpi[] = [
    { label: "Total disputes", value: `${totalCount}`, tone: "neutral" },
    { label: "Open", value: `${openCount}`, tone: openCount > 0 ? "danger" : "neutral", detail: openCount > 0 ? "Awaiting decision" : "None pending" },
    { label: "Under review", value: `${reviewCount}`, tone: reviewCount > 0 ? "warning" : "neutral" },
    { label: "Resolved / Lost", value: `${resolvedCount + lostCount}`, tone: "success", detail: `${resolvedCount} resolved · ${lostCount} lost` },
  ]

  return {
    kpis,
    disputes: disputes.map((d) => ({
      id: d.id,
      transactionId: d.transactionId,
      reference: d.transaction.reference,
      title: d.transaction.title,
      vendorId: d.transaction.vendorId,
      vendorName: d.transaction.vendor?.businessName ?? "Unknown vendor",
      vendorEmail: d.transaction.vendor?.businessEmail ?? "",
      clientName: d.transaction.clientProfile?.fullName ?? "Unknown client",
      clientEmail: d.transaction.clientProfile?.email ?? "",
      depositAmount: formatMoney(d.transaction.depositAuthorization?.amount, d.transaction.depositAuthorization?.currency),
      depositCents: d.transaction.depositAuthorization?.amount ?? 0,
      currency: d.transaction.depositAuthorization?.currency ?? "EUR",
      status: d.status,
      summary: d.summary,
      openedAt: formatDate(d.openedAt),
      resolvedAt: d.resolvedAt ? formatDate(d.resolvedAt) : null,
      resolution: d.resolution ?? null,
      deadlineAt: formatDate(disputeDeadline(d.openedAt)),
      attachmentCount: d.transaction.documents.length,
    })),
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
  }
}

export async function getAdminDisputeDetail(disputeId: string): Promise<AdminDisputeDetailRecord | null> {
  const d = await safeQuery(
    () =>
      prisma.dispute.findUnique({
        where: { id: disputeId },
        include: {
          transaction: {
            include: {
              vendor: { select: { id: true, businessName: true, businessEmail: true, stripeAccountId: true } },
              clientProfile: { select: { fullName: true, email: true } },
              depositAuthorization: { select: { amount: true, currency: true, stripeIntentId: true } },
              documents: {
                orderBy: { uploadedAt: "asc" },
              },
              events: {
                orderBy: { occurredAt: "asc" },
              },
            },
          },
        },
      }),
    null
  )

  if (!d) return null

  const isPending = d.status === "OPEN" || d.status === "UNDER_REVIEW"

  return {
    id: d.id,
    transactionId: d.transactionId,
    reference: d.transaction.reference,
    title: d.transaction.title,
    vendorId: d.transaction.vendorId,
    vendorName: d.transaction.vendor?.businessName ?? "Unknown vendor",
    vendorEmail: d.transaction.vendor?.businessEmail ?? "",
    vendorStripeAccountId: d.transaction.vendor?.stripeAccountId ?? null,
    clientName: d.transaction.clientProfile?.fullName ?? "Unknown client",
    clientEmail: d.transaction.clientProfile?.email ?? "",
    depositAmount: formatMoney(d.transaction.depositAuthorization?.amount, d.transaction.depositAuthorization?.currency),
    depositCents: d.transaction.depositAuthorization?.amount ?? 0,
    currency: d.transaction.depositAuthorization?.currency ?? "EUR",
    stripeIntentId: d.transaction.depositAuthorization?.stripeIntentId ?? null,
    transactionKind: d.transaction.kind,
    serviceAmount: formatMoney(d.transaction.amount, d.transaction.currency),
    status: d.status,
    summary: d.summary,
    openedAt: formatDate(d.openedAt),
    resolvedAt: d.resolvedAt ? formatDate(d.resolvedAt) : null,
    resolution: d.resolution ?? null,
    deadlineAt: formatDate(disputeDeadline(d.openedAt)),
    attachmentCount: d.transaction.documents.length,
    documents: d.transaction.documents.map((doc) => ({
      id: doc.id,
      label: doc.label,
      type: doc.type,
      fileName: doc.fileName,
      assetUrl: doc.assetUrl,
      textValue: doc.textValue,
      uploadedAt: formatDate(doc.uploadedAt),
    })),
    history: [
      ...d.transaction.events.map((ev) => ({
        title: ev.title,
        detail: ev.detail ?? null,
        occurredAt: formatDateTime(ev.occurredAt),
        pending: false,
      })),
      ...(isPending
        ? [{ title: "⏳ Decision pending", detail: `Deadline: ${formatDate(disputeDeadline(d.openedAt))}`, occurredAt: "", pending: true }]
        : []),
    ],
  }
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
  return getStatusToneValue(status)
}

// ── Contact messages ──────────────────────────────────────────────────────────

export type AdminContactListData = {
  items: AdminContactRecord[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  newCount: number
}

export type AdminContactRecord = {
  id: string
  name: string
  email: string
  messagePreview: string
  locale: string
  status: string
  createdAt: string
}

export type AdminContactDetailRecord = {
  id: string
  firstName: string
  lastName: string
  email: string
  message: string
  locale: string
  status: string
  replyText: string | null
  repliedAt: string | null
  ipAddress: string | null
  createdAt: string
}

type AdminContactFilters = { q?: string; status?: string }

export async function getAdminContacts(
  page: number = 1,
  pageSize: number = 20,
  filters: AdminContactFilters = {}
): Promise<AdminContactListData> {
  const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })
  const search = normalizeSearchTerm(filters.q)
  const status = filters.status?.toUpperCase()

  const validStatuses = ["NEW", "READ", "REPLIED", "ARCHIVED"]
  const statusFilter = status && validStatuses.includes(status) ? status : undefined

  const where: Prisma.ContactMessageWhereInput = {
    ...(statusFilter ? { status: statusFilter as "NEW" | "READ" | "REPLIED" | "ARCHIVED" } : {}),
    ...(search
      ? {
          OR: [
            { firstName: containsInsensitive(search) },
            { lastName: containsInsensitive(search) },
            { email: containsInsensitive(search) },
            { message: containsInsensitive(search) },
          ],
        }
      : {}),
  }

  const [items, totalCount, newCount] = await Promise.all([
    safeQuery(
      () =>
        prisma.contactMessage.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
      []
    ),
    safeQuery(() => prisma.contactMessage.count({ where }), 0),
    safeQuery(() => prisma.contactMessage.count({ where: { status: "NEW" } }), 0),
  ])

  return {
    items: items.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      messagePreview: c.message.length > 120 ? `${c.message.slice(0, 120)}…` : c.message,
      locale: c.locale,
      status: c.status,
      createdAt: formatDateTime(c.createdAt),
    })),
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
    newCount,
  }
}

// ── Admin Analytics ────────────────────────────────────────────────────────

const PLAN_MONTHLY_PRICE_CENTS: Record<string, number> = {
  STARTER: 4900,
  PRO: 12900,
  BUSINESS: 24900,
  ENTERPRISE: 0,
}

const PLAN_YEARLY_MONTHLY_CENTS: Record<string, number> = {
  STARTER: 3917,
  PRO: 10417,
  BUSINESS: 20000,
  ENTERPRISE: 0,
}

export type AdminAnalyticsPlanRow = {
  planKey: string
  planName: string
  monthlyCount: number
  yearlyCount: number
  totalCount: number
  estimatedMrr: number
}

export type AdminAnalyticsTrendPoint = {
  month: string
  fees: number
  volume: number
  newSubs: number
}

export type AdminAnalyticsData = {
  // Platform revenue: sum of platformFeeAmount from DEPOSIT_CAPTURE rows (cents)
  totalPlatformFeeCents: number
  // What went to Stripe: sum of stripeFeeAmount from DEPOSIT_CAPTURE rows (cents)
  totalStripeFeeCents: number
  // Gross deposit amount captured (cents)
  totalDepositGrossCents: number
  // Service payment volume: sum of amount from SERVICE_PAYMENT rows (cents)
  totalServiceVolumeCents: number
  // Number of captured deposits all-time
  totalDepositCaptureCount: number
  estimatedMrr: number
  activeSubscriberCount: number
  trialingCount: number
  planBreakdown: AdminAnalyticsPlanRow[]
  monthlyTrend: AdminAnalyticsTrendPoint[]
  billingIntervalSplit: { monthly: number; yearly: number }
  statusBreakdown: { status: string; count: number }[]
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export async function getAdminAnalytics(): Promise<AdminAnalyticsData> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  const [
    depositCaptureAgg,
    serviceVolumeAgg,
    allSubscriptions,
    recentDepositCaptures,
    recentServicePayments,
    recentSubs,
  ] = await Promise.all([
    // Platform fee revenue — DEPOSIT_CAPTURE + CAPTURED is the only source of fee income.
    // SERVICE_PAYMENT rows hardcode platformFeeAmount=0 and must NOT be included here.
    safeQuery(
      () =>
        prisma.payment.aggregate({
          _sum: {
            platformFeeAmount: true,
            stripeFeeAmount: true,
            amount: true,
          },
          _count: { _all: true },
          where: {
            kind: PaymentKind.DEPOSIT_CAPTURE,
            status: PaymentStatus.CAPTURED,
          },
        }),
      { _sum: { platformFeeAmount: null, stripeFeeAmount: null, amount: null }, _count: { _all: 0 } }
    ),
    // Service payment volume — separate from deposit fees.
    safeQuery(
      () =>
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            kind: PaymentKind.SERVICE_PAYMENT,
            status: PaymentStatus.SUCCEEDED,
          },
        }),
      { _sum: { amount: null } }
    ),
    safeQuery(
      () =>
        prisma.vendorSubscription.findMany({
          select: { planKey: true, billingInterval: true, status: true },
        }),
      []
    ),
    // Monthly fee trend: deposit captures in last 12 months.
    safeQuery(
      () =>
        prisma.payment.findMany({
          where: {
            kind: PaymentKind.DEPOSIT_CAPTURE,
            status: PaymentStatus.CAPTURED,
            createdAt: { gte: twelveMonthsAgo },
          },
          select: {
            platformFeeAmount: true,
            amount: true,
            processedAt: true,
            createdAt: true,
          },
        }),
      []
    ),
    // Monthly volume trend: service payments in last 12 months.
    safeQuery(
      () =>
        prisma.payment.findMany({
          where: {
            kind: PaymentKind.SERVICE_PAYMENT,
            status: PaymentStatus.SUCCEEDED,
            createdAt: { gte: twelveMonthsAgo },
          },
          select: { amount: true, processedAt: true, createdAt: true },
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.vendorSubscription.findMany({
          where: { createdAt: { gte: twelveMonthsAgo } },
          select: { createdAt: true },
        }),
      []
    ),
  ])

  const activeSubs = allSubscriptions.filter(
    (s) => s.status === "ACTIVE" || s.status === "TRIALING"
  )
  const trialingCount = allSubscriptions.filter((s) => s.status === "TRIALING").length

  const planKeys = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"]
  const planBreakdown: AdminAnalyticsPlanRow[] = planKeys.map((planKey) => {
    const subs = activeSubs.filter((s) => s.planKey === planKey)
    const monthlyCount = subs.filter((s) => s.billingInterval === "MONTHLY").length
    const yearlyCount = subs.filter((s) => s.billingInterval === "YEARLY").length
    const mrr =
      monthlyCount * (PLAN_MONTHLY_PRICE_CENTS[planKey] ?? 0) +
      yearlyCount * (PLAN_YEARLY_MONTHLY_CENTS[planKey] ?? 0)
    return {
      planKey,
      planName: planKey.charAt(0) + planKey.slice(1).toLowerCase(),
      monthlyCount,
      yearlyCount,
      totalCount: subs.length,
      estimatedMrr: mrr,
    }
  })

  const statusMap = new Map<string, number>()
  for (const s of allSubscriptions) {
    statusMap.set(s.status, (statusMap.get(s.status) ?? 0) + 1)
  }

  const billingIntervalSplit = {
    monthly: activeSubs.filter((s) => s.billingInterval === "MONTHLY").length,
    yearly: activeSubs.filter((s) => s.billingInterval === "YEARLY").length,
  }

  const estimatedMrr = planBreakdown.reduce((acc, p) => acc + p.estimatedMrr, 0)

  // Build the 12-month trend map, seeding every slot to zero so months with no
  // activity still appear in the chart rather than being absent.
  const trendMap = new Map<string, { fees: number; volume: number; newSubs: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    trendMap.set(key, { fees: 0, volume: 0, newSubs: 0 })
  }

  // Fee trend — from deposit captures only.
  for (const p of recentDepositCaptures) {
    const d = p.processedAt ?? p.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = trendMap.get(key)
    if (entry) entry.fees += p.platformFeeAmount ?? 0
  }

  // Volume trend — from service payments only.
  for (const p of recentServicePayments) {
    const d = p.processedAt ?? p.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = trendMap.get(key)
    if (entry) entry.volume += p.amount
  }

  for (const s of recentSubs) {
    const d = s.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const entry = trendMap.get(key)
    if (entry) entry.newSubs += 1
  }

  const monthlyTrend: AdminAnalyticsTrendPoint[] = Array.from(trendMap.entries()).map(
    ([key, data]) => {
      const [year, month] = key.split("-")
      const label = `${MONTH_LABELS[Number.parseInt(month) - 1]} '${year.slice(2)}`
      return {
        month: label,
        fees: Math.round(data.fees / 100),
        volume: Math.round(data.volume / 100),
        newSubs: data.newSubs,
      }
    }
  )

  return {
    totalPlatformFeeCents: depositCaptureAgg._sum.platformFeeAmount ?? 0,
    totalStripeFeeCents: depositCaptureAgg._sum.stripeFeeAmount ?? 0,
    totalDepositGrossCents: depositCaptureAgg._sum.amount ?? 0,
    totalServiceVolumeCents: serviceVolumeAgg._sum.amount ?? 0,
    totalDepositCaptureCount: depositCaptureAgg._count._all,
    estimatedMrr,
    activeSubscriberCount: activeSubs.length,
    trialingCount,
    planBreakdown,
    monthlyTrend,
    billingIntervalSplit,
    statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
  }
}

// ── Deposit Capture Fee Report ─────────────────────────────────────────────
// Raw-SQL aggregate grouped by currency for accurate multi-currency safety.

export type DepositCaptureFeeReportRow = {
  currency: string
  captureCount: number
  grossCapturedCents: number
  stripeFeeCents: number
  platformFeeCents: number
  vendorNetCents: number
  platformFeeEur: string
  grossCapturedEur: string
}

export async function getDepositCaptureFeeReport(): Promise<DepositCaptureFeeReportRow[]> {
  type RawRow = {
    currency: string
    capture_count: bigint
    gross_captured_cents: bigint
    stripe_fee_cents: bigint
    platform_fee_cents: bigint
    vendor_net_cents: bigint
  }

  const rows = await safeQuery(
    () =>
      prisma.$queryRaw<RawRow[]>`
        SELECT
          currency,
          COUNT(*)                                          AS capture_count,
          SUM(amount)                                       AS gross_captured_cents,
          SUM(COALESCE("stripeFeeAmount",   0))             AS stripe_fee_cents,
          SUM(COALESCE("platformFeeAmount", 0))             AS platform_fee_cents,
          SUM(COALESCE("vendorNetAmount",   0))             AS vendor_net_cents
        FROM "Payment"
        WHERE kind   = 'DEPOSIT_CAPTURE'
          AND status = 'CAPTURED'
        GROUP BY currency
        ORDER BY currency
      `,
    []
  )

  return rows.map((row) => {
    const platformFeeCents   = Number(row.platform_fee_cents)
    const grossCapturedCents = Number(row.gross_captured_cents)
    return {
      currency:            row.currency,
      captureCount:        Number(row.capture_count),
      grossCapturedCents,
      stripeFeeCents:      Number(row.stripe_fee_cents),
      platformFeeCents,
      vendorNetCents:      Number(row.vendor_net_cents),
      platformFeeEur:      `€${(platformFeeCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      grossCapturedEur:    `€${(grossCapturedCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }
  })
}

export async function getAdminContactDetail(contactId: string): Promise<AdminContactDetailRecord | null> {
  const c = await safeQuery(
    () => prisma.contactMessage.findUnique({ where: { id: contactId } }),
    null
  )

  if (!c) return null

  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    message: c.message,
    locale: c.locale,
    status: c.status,
    replyText: c.replyText ?? null,
    repliedAt: c.repliedAt ? formatDateTime(c.repliedAt) : null,
    ipAddress: c.ipAddress ?? null,
    createdAt: formatDateTime(c.createdAt),
  }
}
