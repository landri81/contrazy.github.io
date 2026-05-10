import { ExternalLink, FileText } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { cn } from "@/lib/utils"
import { UserDeleteAction, UserRoleActions, VendorReviewActions } from "@/features/dashboard/components/admin-user-actions"
import { AdminDocumentDeleteButton } from "@/features/dashboard/components/admin-document-delete-button"
import { AdminVendorLinksTable } from "@/features/dashboard/components/admin-vendor-links-table"
import { AdminVendorMotionShell } from "@/features/dashboard/components/admin-vendor-motion-shell"
import { AdminVendorProfileForm } from "@/features/dashboard/components/admin-vendor-profile-form"
import { AdminVendorTabShell } from "@/features/dashboard/components/admin-vendor-tab-shell"
import { DetailGrid, KpiGrid, PagePanel, StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import type {
  AdminVendorAuditRecord,
  AdminVendorEventRecord,
  AdminVendorLinkDetailRecord,
  AdminVendorLinksPageRecord,
  AdminVendorProfileRecord,
} from "@/features/dashboard/server/dashboard-data"
import { getStatusTone } from "@/features/dashboard/server/dashboard-data"

type VendorManagerTab = "overview" | "transactions" | "subscription" | "access"
type AdminVendorTransactionsSearchParams = {
  page?: string
  q?: string
  linkStatus?: string
  transactionStatus?: string
  kind?: string
}

function userInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatMoney(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) {
    return "—"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatOptional(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—"
}

function formatBoolean(value: boolean, yesLabel: string, noLabel: string) {
  return value ? yesLabel : noLabel
}

function buildUserDetailHref(userId: string, query: Record<string, string | undefined>) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      search.set(key, value)
    }
  }

  const suffix = search.toString()
  return `/admin/users/${userId}${suffix ? `?${suffix}` : ""}`
}

function buildPublicLinkHref(link: AdminVendorLinkDetailRecord) {
  return `/${link.locale}/t/${link.token}`
}

function buildTransactionsQuery(links: AdminVendorLinksPageRecord | null): AdminVendorTransactionsSearchParams {
  if (!links) {
    return {}
  }

  return {
    page: links.page > 1 ? String(links.page) : undefined,
    q: links.filters.q || undefined,
    linkStatus: links.filters.linkStatus ?? undefined,
    transactionStatus: links.filters.transactionStatus ?? undefined,
    kind: links.filters.kind ?? undefined,
  }
}

function mergeLifecycleTrail(events: AdminVendorEventRecord[], audits: AdminVendorAuditRecord[]) {
  return [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      detail: event.detail,
      label: event.type,
      kind: "event" as const,
      timestamp: event.timestamp,
      dateLabel: event.occurredAt,
    })),
    ...audits.map((audit) => ({
      id: `audit-${audit.id}`,
      title: audit.action,
      detail: audit.metadataSummary ? `${audit.actor} · ${audit.metadataSummary}` : audit.actor,
      label: audit.actorType,
      kind: "audit" as const,
      timestamp: audit.timestamp,
      dateLabel: audit.createdAt,
    })),
  ].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
}

function NodeFacts({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
          <div className="mt-1.5 min-w-0 text-sm font-medium text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function LifecycleNode({
  title,
  badge,
  children,
  isLast = false,
}: {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className="grid grid-cols-[1.2rem_minmax(0,1fr)] gap-4">
      <div className="flex flex-col items-center">
        <span className="mt-2 size-3 rounded-full border-2 border-(--contrazy-teal) bg-background" />
        {!isLast ? <span className="mt-2 w-px flex-1 bg-border" /> : null}
      </div>

      <div className={cn(!isLast && "pb-5")}>
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {badge}
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

function DocumentResponse({
  userId,
  linkId,
  documentId,
  fileName,
  assetUrl,
  textValue,
  canDelete,
  openLabel,
}: {
  userId: string
  linkId: string
  documentId: string
  fileName: string | null
  assetUrl: string | null
  textValue: string | null
  canDelete: boolean
  openLabel: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {assetUrl ? (
          <a
            href={resolveDocumentAssetUrl(assetUrl, fileName) ?? assetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-(--contrazy-teal) hover:underline"
          >
            <FileText className="size-3.5" />
            {fileName ?? openLabel}
          </a>
        ) : textValue ? (
          <p className="max-w-2xl whitespace-pre-wrap text-sm text-foreground">{textValue}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      {canDelete ? (
        <AdminDocumentDeleteButton
          userId={userId}
          linkId={linkId}
          documentId={documentId}
        />
      ) : null}
    </div>
  )
}

function PaymentSnapshot({
  title,
  record,
  emptyLabel,
}: {
  title: string
  record:
    | AdminVendorLinkDetailRecord["servicePayment"]
    | AdminVendorLinkDetailRecord["depositCapture"]
    | AdminVendorLinkDetailRecord["depositRelease"]
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {record ? <StatusBadge tone={getStatusTone(record.status)}>{record.status}</StatusBadge> : null}
      </div>

      {record ? (
        <NodeFacts
          items={[
            { label: "Amount", value: formatMoney(record.amount, record.currency) },
            { label: "Processed", value: formatOptional(record.processedAt) },
            {
              label: "Stripe",
              value:
                record.stripeIntentId != null ? (
                  <span className="block break-all font-mono text-[10px] leading-4">
                    {record.stripeIntentId}
                  </span>
                ) : (
                  "—"
                ),
            },
            { label: "Stripe fee", value: formatMoney(record.stripeFeeAmount, record.currency) },
            { label: "Platform fee", value: formatMoney(record.platformFeeAmount, record.currency) },
            { label: "Vendor net", value: formatMoney(record.vendorNetAmount, record.currency) },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

function DepositAuthorizationSnapshot({
  record,
  emptyLabel,
}: {
  record: AdminVendorLinkDetailRecord["depositAuth"]
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Deposit authorization</p>
        {record ? <StatusBadge tone={getStatusTone(record.status)}>{record.status}</StatusBadge> : null}
      </div>

      {record ? (
        <NodeFacts
          items={[
            { label: "Amount", value: formatMoney(record.amount, record.currency) },
            { label: "Authorized", value: formatOptional(record.authorizedAt) },
            { label: "Captured", value: formatOptional(record.capturedAt) },
            { label: "Released", value: formatOptional(record.releasedAt) },
            {
              label: "Stripe",
              value:
                record.stripeIntentId != null ? (
                  <span className="block break-all font-mono text-[10px] leading-4">
                    {record.stripeIntentId}
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

function LinkLifecycleTree({
  userId,
  link,
  canDeleteDocuments,
  t,
}: {
  userId: string
  link: AdminVendorLinkDetailRecord
  canDeleteDocuments: boolean
  t: Awaited<ReturnType<typeof getTranslations>>
}) {
  const requirementRows = link.requirements.map((requirement) => ({
    requirement,
    response: link.documents.find((document) => document.requirementId === requirement.id) ?? null,
  }))
  const extraDocuments = link.documents.filter((document) => !document.requirementId)
  const lifecycleTrail = mergeLifecycleTrail(link.events, link.auditLogs)
  const missingRequiredCount = Math.max(link.documentSummary.requiredCount - link.documentSummary.submittedRequiredCount, 0)

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{link.reference}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{link.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={getStatusTone(link.status)}>{link.status}</StatusBadge>
              <StatusBadge tone={getStatusTone(link.transactionStatus)}>{link.transactionStatus}</StatusBadge>
              <StatusBadge tone={getStatusTone(link.kind)}>{link.kind}</StatusBadge>
            </div>
          </div>

          <NodeFacts
            items={[
              { label: t("transactions.columns.service"), value: formatMoney(link.amount, link.currency) },
              { label: t("transactions.columns.deposit"), value: formatMoney(link.depositAmount, link.currency) },
              { label: t("transactions.columns.lastActivity"), value: link.updatedAt },
              { label: t("transactions.columns.documents"), value: link.documentSummary.submittedCount.toString() },
            ]}
          />
        </CardContent>
      </Card>

      <div className="space-y-0">
        <LifecycleNode
          title={t("transactions.lifecycle.link")}
          badge={<StatusBadge tone={getStatusTone(link.status)}>{link.status}</StatusBadge>}
        >
          <NodeFacts
            items={[
              { label: "Short code", value: formatOptional(link.shortCode) },
              { label: "Created", value: link.createdAt },
              { label: "Opened", value: formatOptional(link.openedAt) },
              { label: "Expires", value: formatOptional(link.expiresAt) },
              { label: "Completed", value: formatOptional(link.completedAt) },
              { label: "Cancelled", value: formatOptional(link.cancelledAt) },
            ]}
          />

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <a
              href={buildPublicLinkHref(link)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-(--contrazy-teal) hover:underline"
            >
              {t("transactions.openPublicLink")}
              <ExternalLink className="size-3.5" />
            </a>
            {link.cancelReason ? <span className="text-muted-foreground">{link.cancelReason}</span> : null}
          </div>
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.client")}
          badge={link.client ? <StatusBadge tone="success">{t("transactions.clientReady")}</StatusBadge> : <StatusBadge tone="warning">{t("transactions.clientMissing")}</StatusBadge>}
        >
          <NodeFacts
            items={[
              { label: "Name", value: link.client?.fullName ?? "—" },
              { label: "Email", value: link.client?.email ?? "—" },
              { label: "Phone", value: formatOptional(link.client?.phone) },
              { label: "Company", value: formatOptional(link.client?.companyName) },
              { label: "Country", value: formatOptional(link.client?.country) },
              {
                label: "Company required",
                value: formatBoolean(link.requireClientCompany, t("shared.yes"), t("shared.no")),
              },
            ]}
          />
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.documents")}
          badge={
            missingRequiredCount === 0 ? (
              <StatusBadge tone="success">
                {link.documentSummary.submittedRequiredCount}/{link.documentSummary.requiredCount}
              </StatusBadge>
            ) : (
              <StatusBadge tone="warning">
                {link.documentSummary.submittedRequiredCount}/{link.documentSummary.requiredCount}
              </StatusBadge>
            )
          }
        >
          <div className="space-y-3">
            {requirementRows.length > 0 ? (
              requirementRows.map(({ requirement, response }) => (
                <div key={requirement.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {requirement.type}
                        {requirement.required ? ` · ${t("transactions.required")}` : ""}
                      </p>
                    </div>
                    <StatusBadge tone={response ? "success" : "warning"}>
                      {response ? t("transactions.submitted") : t("transactions.pending")}
                    </StatusBadge>
                  </div>

                  {response ? (
                    <DocumentResponse
                      userId={userId}
                      linkId={link.id}
                      documentId={response.id}
                      fileName={response.fileName}
                      assetUrl={response.assetUrl}
                      textValue={response.textValue}
                      canDelete={canDeleteDocuments}
                      openLabel={t("transactions.openDocument")}
                    />
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("transactions.noRequirements")}</p>
            )}

            {extraDocuments.length > 0 ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">{t("transactions.otherUploads")}</p>
                <div className="space-y-3">
                  {extraDocuments.map((document) => (
                    <DocumentResponse
                      key={document.id}
                      userId={userId}
                      linkId={link.id}
                      documentId={document.id}
                      fileName={document.fileName}
                      assetUrl={document.assetUrl}
                      textValue={document.textValue}
                      canDelete={canDeleteDocuments}
                      openLabel={t("transactions.openDocument")}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.kyc")}
          badge={
            !link.requiresKyc ? (
              <StatusBadge tone="neutral">{t("transactions.notRequired")}</StatusBadge>
            ) : link.kyc ? (
              <StatusBadge tone={getStatusTone(link.kyc.status)}>{link.kyc.status}</StatusBadge>
            ) : (
              <StatusBadge tone="warning">{t("transactions.pending")}</StatusBadge>
            )
          }
        >
          {link.requiresKyc ? (
            <div className="space-y-4">
              <NodeFacts
                items={[
                  { label: "Provider", value: link.kyc?.provider ?? "—" },
                  { label: "Created", value: link.kyc?.createdAt ?? "—" },
                  { label: "Verified", value: formatOptional(link.kyc?.verifiedAt) },
                ]}
              />

              {link.kyc?.summary?.startsWith("http") ? (
                <a
                  href={resolveDocumentAssetUrl(link.kyc.summary) ?? link.kyc.summary}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-(--contrazy-teal) hover:underline"
                >
                  {t("transactions.openDocument")}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          ) : null}
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.agreement")}
          badge={
            link.signature ? (
              <StatusBadge tone={getStatusTone(link.signature.status)}>{link.signature.status}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{t("transactions.notStarted")}</StatusBadge>
            )
          }
        >
          <div className="space-y-4">
            <NodeFacts
              items={[
                { label: "Template", value: formatOptional(link.contract?.sourceTemplateName) },
                { label: "Snapshot", value: formatOptional(link.contract?.generatedAt) },
                { label: "Reviewed", value: formatOptional(link.contract?.reviewCompletedAt) },
                { label: "Signed", value: formatOptional(link.signature?.signedAt ?? link.contract?.signedAt) },
              ]}
            />

            {link.contract?.signedPdfUrl ? (
              <a
                href={resolveDocumentAssetUrl(link.contract.signedPdfUrl, `${link.reference}-signed.pdf`) ?? link.contract.signedPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-(--contrazy-teal) hover:underline"
              >
                {t("transactions.downloadSigned")}
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.finance")}
          badge={<StatusBadge tone={getStatusTone(link.transactionStatus)}>{link.transactionStatus}</StatusBadge>}
        >
          <div className="space-y-4">
            <NodeFacts
              items={[
                { label: "Timing", value: link.paymentCollectionTiming },
                { label: "Service", value: formatMoney(link.amount, link.currency) },
                { label: "Deposit", value: formatMoney(link.depositAmount, link.currency) },
                { label: "Completed by client", value: formatOptional(link.customerCompletedAt) },
              ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <PaymentSnapshot
                title={t("transactions.servicePayment")}
                record={link.servicePayment}
                emptyLabel={t("transactions.noServicePayment")}
              />

              <DepositAuthorizationSnapshot
                record={link.depositAuth}
                emptyLabel={t("transactions.noDepositAuth")}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PaymentSnapshot
                title={t("transactions.depositCapture")}
                record={link.depositCapture}
                emptyLabel={t("transactions.noDepositCapture")}
              />

              <PaymentSnapshot
                title={t("transactions.depositRelease")}
                record={link.depositRelease}
                emptyLabel={t("transactions.noDepositRelease")}
              />
            </div>
          </div>
        </LifecycleNode>

        <LifecycleNode
          title={t("transactions.lifecycle.audit")}
          isLast
          badge={<StatusBadge tone="neutral">{lifecycleTrail.length}</StatusBadge>}
        >
          {lifecycleTrail.length > 0 ? (
            <div className="space-y-3">
              {lifecycleTrail.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={item.kind === "event" ? "info" : "neutral"}>
                      {item.kind === "event" ? t("transactions.event") : t("transactions.audit")}
                    </StatusBadge>
                    <StatusBadge tone={getStatusTone(item.label)}>{item.label}</StatusBadge>
                    <span className="text-xs text-muted-foreground">{item.dateLabel}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">{item.title}</p>
                  {item.detail ? <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("transactions.emptyAudit")}</p>
          )}
        </LifecycleNode>
      </div>
    </div>
  )
}

export async function AdminVendorProfileView({
  data,
  activeTab,
}: {
  data: AdminVendorProfileRecord
  activeTab: VendorManagerTab
}) {
  const t = await getTranslations("dashboard.admin.vendorManager")
  const user = data.user
  const vendorProfile = data.user.vendorProfile
  const links = data.links
  const transactionsQuery = buildTransactionsQuery(links)

  const tabs: Array<{ key: VendorManagerTab; label: string }> = [
    { key: "overview", label: t("tabs.overview") },
    { key: "transactions", label: t("tabs.transactions") },
    { key: "subscription", label: t("tabs.subscription") },
    { key: "access", label: t("tabs.access") },
  ]

  return (
    <AdminVendorMotionShell className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-(--contrazy-teal)/10 text-lg font-bold text-(--contrazy-teal) ring-2 ring-(--contrazy-teal)/20">
                {userInitials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    {vendorProfile?.businessName || user.name}
                  </h1>
                  <StatusBadge tone={getStatusTone(user.role)}>{user.role}</StatusBadge>
                  {vendorProfile ? (
                    <StatusBadge tone={getStatusTone(vendorProfile.reviewStatus)}>
                      {vendorProfile.reviewStatus}
                    </StatusBadge>
                  ) : null}
                  {vendorProfile ? (
                    <StatusBadge tone={getStatusTone(vendorProfile.stripeConnectionStatus)}>
                      {vendorProfile.stripeConnectionStatus}
                    </StatusBadge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("header.joined", { date: user.joinedAt })}</span>
                  <span>{t("header.company", { company: user.company })}</span>
                  <span className="font-mono opacity-70">ID: {user.id}</span>
                </div>
              </div>
            </div>

            <div className="">
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("header.owner")}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{user.name}</p>
              </div>
              
            </div>
          </div>

          {vendorProfile ? (
            <KpiGrid
              items={[
                {
                  label: t("kpis.transactions"),
                  value: vendorProfile.transactionCount.toString(),
                  detail: t("kpis.transactionDetail"),
                },
                {
                  label: t("kpis.clients"),
                  value: vendorProfile.clientCount.toString(),
                  detail: t("kpis.clientDetail"),
                },
                {
                  label: t("kpis.profile"),
                  value: `${vendorProfile.profileCompletion}%`,
                  detail: vendorProfile.profileCompletion === 100 ? t("kpis.profileComplete") : t("kpis.profileIncomplete"),
                  tone: vendorProfile.profileCompletion === 100 ? "success" : "warning",
                },
                {
                  label: t("kpis.subscription"),
                  value: data.subscription?.planKey ?? t("subscription.noSubscription"),
                  detail: data.subscription?.status ?? t("subscription.noSubscriptionDetail"),
                  tone: data.subscription ? getStatusTone(data.subscription.status) : "neutral",
                },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      <AdminVendorTabShell
        activeTab={activeTab}
        tabs={tabs.map((tab) => ({
          ...tab,
          href: buildUserDetailHref(user.id, {
            tab: tab.key,
            ...transactionsQuery,
          }),
        }))}
      >
        {activeTab === "overview" ? (
          vendorProfile ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <PagePanel title={t("overview.accountTitle")} description={t("overview.accountDescription")}>
                <DetailGrid
                  items={[
                    { label: t("overview.fields.fullName"), value: user.name },
                    { label: t("overview.fields.email"), value: user.email },
                    {
                      label: t("overview.fields.reviewStatus"),
                      value: <StatusBadge tone={getStatusTone(vendorProfile.reviewStatus)}>{vendorProfile.reviewStatus}</StatusBadge>,
                    },
                    {
                      label: t("overview.fields.payoutStatus"),
                      value: (
                        <StatusBadge tone={getStatusTone(vendorProfile.stripeConnectionStatus)}>
                          {vendorProfile.stripeConnectionStatus}
                        </StatusBadge>
                      ),
                    },
                    { label: t("overview.fields.businessName"), value: formatOptional(vendorProfile.businessName) },
                    { label: t("overview.fields.registrationNumber"), value: formatOptional(vendorProfile.registrationNumber) },
                    { label: t("overview.fields.supportEmail"), value: formatOptional(vendorProfile.supportEmail) },
                    { label: t("overview.fields.phone"), value: formatOptional(vendorProfile.businessPhone) },
                    { label: t("overview.fields.country"), value: formatOptional(vendorProfile.businessCountry) },
                    { label: t("overview.fields.address"), value: formatOptional(vendorProfile.businessAddress) },
                    { label: t("overview.fields.vatNumber"), value: formatOptional(vendorProfile.vatNumber) },
                    { label: t("overview.fields.defaultLocale"), value: vendorProfile.preferredLocale.toUpperCase() },
                  ]}
                />
              </PagePanel>

              <PagePanel title={t("overview.editorTitle")} description={t("overview.editorDescription")}>
                <AdminVendorProfileForm
                  userId={user.id}
                  initialValues={{
                    ownerFirstName: vendorProfile.ownerFirstName,
                    ownerLastName: vendorProfile.ownerLastName,
                    businessName: vendorProfile.businessName,
                    businessEmail: vendorProfile.businessEmail || user.email,
                    supportEmail: vendorProfile.supportEmail,
                    businessPhone: vendorProfile.businessPhone,
                    businessAddress: vendorProfile.businessAddress,
                    businessCountry: vendorProfile.businessCountry,
                    registrationNumber: vendorProfile.registrationNumber,
                    vatNumber: vendorProfile.vatNumber,
                    preferredLocale: vendorProfile.preferredLocale === "fr" ? "fr" : "en",
                  }}
                />
              </PagePanel>
            </div>
          ) : (
            <PagePanel title={t("overview.accountTitle")} description={t("overview.accountDescription")}>
              <p className="text-sm text-muted-foreground">{t("overview.noVendorProfile")}</p>
            </PagePanel>
          )
        ) : null}

        {activeTab === "transactions" ? (
          links ? (
            <PagePanel title={t("transactions.listTitle")} description={t("transactions.listDescription")}>
              <AdminVendorLinksTable userId={user.id} links={links} />
            </PagePanel>
          ) : (
            <PagePanel title={t("transactions.listTitle")} description={t("transactions.listDescription")}>
              <p className="text-sm text-muted-foreground">{t("transactions.empty")}</p>
            </PagePanel>
          )
        ) : null}

        {activeTab === "subscription" ? (
          data.subscription ? (
            <div className="space-y-6">
              <PagePanel title={t("subscription.title")} description={t("subscription.description")}>
                <DetailGrid
                  items={[
                    { label: t("subscription.fields.plan"), value: data.subscription.planKey },
                    { label: t("subscription.fields.interval"), value: data.subscription.billingInterval },
                    {
                      label: t("subscription.fields.status"),
                      value: <StatusBadge tone={getStatusTone(data.subscription.status)}>{data.subscription.status}</StatusBadge>,
                    },
                    { label: t("subscription.fields.currentPeriodStart"), value: data.subscription.currentPeriodStart ?? "—" },
                    { label: t("subscription.fields.currentPeriodEnd"), value: data.subscription.currentPeriodEnd ?? "—" },
                    {
                      label: t("subscription.fields.cancelAtPeriodEnd"),
                      value: formatBoolean(data.subscription.cancelAtPeriodEnd, t("shared.yes"), t("shared.no")),
                    },
                    { label: t("subscription.fields.trialStart"), value: data.subscription.trialStart ?? "—" },
                    { label: t("subscription.fields.trialEnd"), value: data.subscription.trialEnd ?? "—" },
                  ]}
                />
              </PagePanel>

              <KpiGrid
                items={[
                  {
                    label: t("subscription.usage.transactions"),
                    value: data.subscription.transactionsUsed.toString(),
                  },
                  {
                    label: t("subscription.usage.signatures"),
                    value: data.subscription.eSignaturesUsed.toString(),
                  },
                  {
                    label: t("subscription.usage.kyc"),
                    value: data.subscription.kycVerificationsUsed.toString(),
                  },
                  {
                    label: t("subscription.usage.qr"),
                    value: data.subscription.qrCodesUsed.toString(),
                  },
                ]}
              />
            </div>
          ) : (
            <PagePanel title={t("subscription.title")} description={t("subscription.description")}>
              <p className="text-sm text-muted-foreground">{t("subscription.empty")}</p>
            </PagePanel>
          )
        ) : null}

        {activeTab === "access" ? (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <PagePanel title={t("access.roleTitle")} description={t("access.roleDescription")}>
                <UserRoleActions userId={user.id} currentRole={user.role} />
              </PagePanel>

              {vendorProfile ? (
                <PagePanel title={t("access.reviewTitle")} description={t("access.reviewDescription")}>
                  <VendorReviewActions userId={user.id} currentStatus={vendorProfile.reviewStatus} />
                </PagePanel>
              ) : null}
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 dark:border-red-900 dark:bg-red-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">{t("access.dangerTitle")}</h3>
                  <p className="mt-1 max-w-prose text-sm text-red-700 dark:text-red-500">
                    {t("access.dangerDescription")}
                  </p>
                </div>
                <div className="shrink-0">
                  <UserDeleteAction userId={user.id} userEmail={user.email} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </AdminVendorTabShell>
    </AdminVendorMotionShell>
  )
}

export async function AdminVendorLinkDetailView({
  data,
  searchParams,
  canDeleteDocuments = false,
}: {
  data: AdminVendorProfileRecord
  searchParams?: AdminVendorTransactionsSearchParams
  canDeleteDocuments?: boolean
}) {
  const t = await getTranslations("dashboard.admin.vendorManager")
  const user = data.user
  const link = data.selectedLink

  if (!link) {
    return null
  }

  const linkStatusLabels = {
    ACTIVE: t("transactions.filterOptions.linkStatus.ACTIVE"),
    PROCESSING: t("transactions.filterOptions.linkStatus.PROCESSING"),
    COMPLETED: t("transactions.filterOptions.linkStatus.COMPLETED"),
    CANCELLED: t("transactions.filterOptions.linkStatus.CANCELLED"),
  }
  const transactionStatusLabels = {
    DRAFT: t("transactions.filterOptions.transactionStatus.DRAFT"),
    LINK_SENT: t("transactions.filterOptions.transactionStatus.LINK_SENT"),
    CUSTOMER_STARTED: t("transactions.filterOptions.transactionStatus.CUSTOMER_STARTED"),
    DOCS_SUBMITTED: t("transactions.filterOptions.transactionStatus.DOCS_SUBMITTED"),
    KYC_VERIFIED: t("transactions.filterOptions.transactionStatus.KYC_VERIFIED"),
    CONTRACT_GENERATED: t("transactions.filterOptions.transactionStatus.CONTRACT_GENERATED"),
    SIGNED: t("transactions.filterOptions.transactionStatus.SIGNED"),
    PAYMENT_AUTHORIZED: t("transactions.filterOptions.transactionStatus.PAYMENT_AUTHORIZED"),
    COMPLETED: t("transactions.filterOptions.transactionStatus.COMPLETED"),
    CANCELLED: t("transactions.filterOptions.transactionStatus.CANCELLED"),
    DISPUTED: t("transactions.filterOptions.transactionStatus.DISPUTED"),
  }
  const kindLabels = {
    PAYMENT: t("transactions.filterOptions.kind.PAYMENT"),
    DEPOSIT: t("transactions.filterOptions.kind.DEPOSIT"),
    HYBRID: t("transactions.filterOptions.kind.HYBRID"),
  }

  const backHref = buildUserDetailHref(user.id, {
    tab: "transactions",
    page: searchParams?.page,
    q: searchParams?.q,
    linkStatus: searchParams?.linkStatus,
    transactionStatus: searchParams?.transactionStatus,
    kind: searchParams?.kind,
  })

  return (
    <AdminVendorMotionShell className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("transactions.backToLinks")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{link.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {link.reference} · {user.name}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(link.status)}>
            {linkStatusLabels[link.status as keyof typeof linkStatusLabels] ?? link.status}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(link.transactionStatus)}>
            {transactionStatusLabels[link.transactionStatus as keyof typeof transactionStatusLabels] ?? link.transactionStatus}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(link.kind)}>
            {kindLabels[link.kind as keyof typeof kindLabels] ?? link.kind}
          </StatusBadge>
        </div>
      </div>

      <LinkLifecycleTree
        userId={user.id}
        link={link}
        canDeleteDocuments={canDeleteDocuments}
        t={t}
      />
    </AdminVendorMotionShell>
  )
}
