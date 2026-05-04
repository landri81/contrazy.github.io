import { requireSubscribedVendorAccess } from "@/lib/auth/guards"
import { isAdminRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/db/prisma"
import { buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DepositControlCard } from "@/features/dashboard/components/deposit-control-card"
import { KycReviewCard } from "@/features/dashboard/components/kyc-review-card"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"

export const dynamic = "force-dynamic"

export default async function VendorTransactionDetailPage(props: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await props.params
  const { session, dbUser, subscription } = await requireSubscribedVendorAccess()
  const isAdmin = isAdminRole(session.user.role)

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
    },
    include: {
      vendor: true,
      clientProfile: true,
      link: true,
      requirements: true,
      documents: true,
      payments: true,
      depositAuthorization: true,
      signatureRecord: true,
      kycVerification: true,
      events: {
        orderBy: { occurredAt: "asc" },
      },
    }
  })

  if (!transaction) {
    notFound()
  }

  if (!isAdmin) {
    const currentVendorUserId = dbUser?.id
    const transactionOwnerUserId = transaction.vendor?.userId

    if (!currentVendorUserId || transactionOwnerUserId !== currentVendorUserId) {
      notFound()
    }
  }

  const shareLink = transaction.link ? `${getAppBaseUrl()}/t/${transaction.link.token}` : null
  const linkRecord = transaction.link
    ? buildVendorLinkRecord({
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
        link: transaction.link,
      }, { qrRemaining: remainingQrCodes(subscription) })
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{transaction.title}</h1>
          <p className="text-muted-foreground mt-2">
            Reference: {transaction.reference}
          </p>
        </div>
        <Badge variant={transaction.status === "COMPLETED" ? "default" : "secondary"}>
          {transaction.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {transaction.clientProfile?.fullName || "Pending"}
            </div>
            {transaction.clientProfile?.email && (
              <div className="text-xs text-muted-foreground truncate">
                {transaction.clientProfile.email}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.payments.find(p => p.kind === "SERVICE_PAYMENT")?.status || (transaction.amount ? "Pending" : "N/A")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deposit Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.depositAuthorization?.status || (transaction.depositAmount ? "Pending" : "None")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Docs Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.documents.length} / {transaction.requirements.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {transaction.depositAuthorization && (
        <DepositControlCard
          transactionId={transaction.id}
          depositStatus={transaction.depositAuthorization.status}
          transactionStatus={transaction.status}
          amount={transaction.depositAuthorization.amount}
          currency={transaction.depositAuthorization.currency}
        />
      )}

      {transaction.link ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Client access</CardTitle>
                <CardDescription>Reuse the secure link, QR code, or cancellation controls for this transaction.</CardDescription>
              </div>
              {linkRecord ? (
                <StatusBadge tone={getStatusTone(linkRecord.status)}>
                  {linkRecord.status}
                </StatusBadge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Customer link</p>
              <Link
                href={shareLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cursor-pointer items-center text-(--contrazy-teal) hover:underline"
              >
                Open secure client flow
              </Link>
              <p className="mt-2 text-xs">Reference: {transaction.reference}</p>
              {linkRecord?.cancelReason ? (
                <p className="mt-2 text-xs text-destructive">
                  Cancelled: {linkRecord.cancelReason}
                  {linkRecord.cancelledAtLabel ? ` • ${linkRecord.cancelledAtLabel}` : ""}
                </p>
              ) : null}
            </div>
            {linkRecord?.qrCodeSvg ? (
              <div
                className="flex w-fit items-center justify-center rounded-lg border bg-white p-4 [&_svg]:block [&_svg]:h-44 [&_svg]:w-44"
                dangerouslySetInnerHTML={{ __html: linkRecord.qrCodeSvg }}
              />
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No QR generated yet</p>
                <p className="mt-1">
                  {linkRecord?.canGenerateQr
                    ? "Generate a QR code when you want to share this transaction in person."
                    : linkRecord?.qrUnavailableReason ?? "QR is not available for this link state."}
                </p>
              </div>
            )}
            {linkRecord ? <PaymentLinkManagementActions record={linkRecord} variant="detail" /> : null}
          </CardContent>
        </Card>
      ) : null}

      {transaction.requiresKyc && transaction.kycVerification && (
        <KycReviewCard
          transactionId={transaction.id}
          kyc={transaction.kycVerification}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Activity log for this transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transaction.events.length > 0 ? (
              transaction.events.map((event) => (
                <div key={event.id} className="flex gap-4">
                  <div className="w-28 shrink-0 text-sm text-muted-foreground">
                    {event.occurredAt.toLocaleDateString()}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>{event.title}</div>
                    {event.detail ? <div className="text-muted-foreground">{event.detail}</div> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex gap-4">
                <div className="w-28 shrink-0 text-sm text-muted-foreground">
                  {transaction.createdAt.toLocaleDateString()}
                </div>
                <div className="text-sm">Transaction created</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
