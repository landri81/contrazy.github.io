import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DepositControlCard } from "@/features/dashboard/components/deposit-control-card"

export default async function VendorTransactionDetailPage({ params }: { params: { transactionId: string } }) {
  const { dbUser } = await requireVendorAccess()

  const transaction = await prisma.transaction.findUnique({
    where: { 
      id: params.transactionId,
      vendorId: dbUser.vendorProfile?.id
    },
    include: {
      clientProfile: true,
      link: true,
      requirements: true,
      documents: true,
      payments: true,
      depositAuthorization: true,
      signatureRecord: true,
    }
  })

  if (!transaction) {
    notFound()
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Activity log for this transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                {transaction.createdAt.toLocaleDateString()}
              </div>
              <div className="text-sm">Transaction created</div>
            </div>
            {transaction.link?.openedAt && (
              <div className="flex gap-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                  {transaction.link.openedAt.toLocaleDateString()}
                </div>
                <div className="text-sm">Client opened link</div>
              </div>
            )}
            {transaction.clientProfile && (
              <div className="flex gap-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                  {transaction.clientProfile.createdAt.toLocaleDateString()}
                </div>
                <div className="text-sm">Client provided details</div>
              </div>
            )}
            {transaction.signatureRecord && (
              <div className="flex gap-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                  {transaction.signatureRecord.signedAt?.toLocaleDateString()}
                </div>
                <div className="text-sm">Client signed contract</div>
              </div>
            )}
            {transaction.link?.completedAt && (
              <div className="flex gap-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">
                  {transaction.link.completedAt.toLocaleDateString()}
                </div>
                <div className="text-sm font-medium text-green-600">Transaction completed</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
