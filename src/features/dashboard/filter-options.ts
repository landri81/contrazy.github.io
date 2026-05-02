export type DashboardFilterOption = {
  label: string
  value: string
}

export const vendorTransactionStatusOptions: DashboardFilterOption[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "Link sent", value: "LINK_SENT" },
  { label: "Customer started", value: "CUSTOMER_STARTED" },
  { label: "Documents submitted", value: "DOCS_SUBMITTED" },
  { label: "KYC verified", value: "KYC_VERIFIED" },
  { label: "Contract generated", value: "CONTRACT_GENERATED" },
  { label: "Signed", value: "SIGNED" },
  { label: "Payment authorized", value: "PAYMENT_AUTHORIZED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Disputed", value: "DISPUTED" },
]

export const vendorTransactionKindOptions: DashboardFilterOption[] = [
  { label: "Payment", value: "PAYMENT" },
  { label: "Deposit", value: "DEPOSIT" },
  { label: "Hybrid", value: "HYBRID" },
]

export const vendorKycStatusOptions: DashboardFilterOption[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Failed", value: "FAILED" },
]

export const vendorSignatureStatusOptions: DashboardFilterOption[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Signed", value: "SIGNED" },
  { label: "Expired", value: "EXPIRED" },
]

export const vendorPaymentStatusOptions: DashboardFilterOption[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Authorized", value: "AUTHORIZED" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Captured", value: "CAPTURED" },
  { label: "Released", value: "RELEASED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
]

export const vendorDisputeStatusOptions: DashboardFilterOption[] = [
  { label: "Open", value: "OPEN" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Lost", value: "LOST" },
]

export const vendorLinkStateOptions: DashboardFilterOption[] = [
  { label: "Issued", value: "ISSUED" },
  { label: "Opened", value: "OPENED" },
  { label: "Completed", value: "COMPLETED" },
]

export const vendorWebhookStatusOptions: DashboardFilterOption[] = [
  { label: "Received", value: "RECEIVED" },
  { label: "Processed", value: "PROCESSED" },
  { label: "Failed", value: "FAILED" },
]

export const adminRoleOptions: DashboardFilterOption[] = [
  { label: "Super Admin", value: "SUPER_ADMIN" },
  { label: "Admin", value: "ADMIN" },
  { label: "Vendor", value: "VENDOR" },
  { label: "Client", value: "CLIENT" },
]

export const adminReviewStatusOptions: DashboardFilterOption[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
]

export const adminStripeConnectionOptions: DashboardFilterOption[] = [
  { label: "Not connected", value: "NOT_CONNECTED" },
  { label: "Pending", value: "PENDING" },
  { label: "Connected", value: "CONNECTED" },
  { label: "Error", value: "ERROR" },
]

export const adminInviteStatusOptions: DashboardFilterOption[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Revoked", value: "REVOKED" },
]

export const adminLogSourceOptions: DashboardFilterOption[] = [
  { label: "Audit log", value: "AUDIT" },
  { label: "Webhook", value: "WEBHOOK" },
]

export const adminSessionStateOptions: DashboardFilterOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Expired", value: "EXPIRED" },
]

export function normalizeFilterOptionValue(
  value: string | null | undefined,
  options: readonly DashboardFilterOption[]
) {
  const normalized = value?.trim()

  if (!normalized || normalized === "all") {
    return undefined
  }

  return options.some((option) => option.value === normalized) ? normalized : undefined
}
