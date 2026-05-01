import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DepositControlCard } from "@/features/dashboard/components/deposit-control-card"

export default async function VendorTransactionDetailPage(props: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await props.params
  const { vendorProfile } = await requireVendorProfileAccess()

  const transaction = await prisma.transaction.findFirst({
    where: { 
      id: transactionId,
      vendorId: vendorProfile.id
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

  const shareLink = transaction.link ? `${getAppBaseUrl()}/t/${transaction.link.token}` : null

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
          amount={transaction.depositAuthorization.amount}
          currency={transaction.depositAuthorization.currency}
        />
      )}

      {transaction.link ? (
        <Card>
          <CardHeader>
            <CardTitle>Client access</CardTitle>
            <CardDescription>Reuse the secure link or QR code for this transaction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Customer link</p>
              <Link
                href={shareLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-[var(--contrazy-teal)] hover:underline"
              >
                Open secure client flow
              </Link>
              <p className="mt-2 text-xs">Reference: {transaction.reference}</p>
            </div>
            {transaction.link.qrCodeSvg ? (
              <div
                className="flex w-fit items-center justify-center rounded-lg border bg-white p-4"
                dangerouslySetInnerHTML={{ __html: transaction.link.qrCodeSvg }}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                  <div className="w-28 flex-shrink-0 text-sm text-muted-foreground">
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
                <div className="w-28 flex-shrink-0 text-sm text-muted-foreground">
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
