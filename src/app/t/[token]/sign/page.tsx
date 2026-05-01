import { redirect } from "next/navigation"

import { ClientSignForm } from "@/features/client-flow/components/client-sign-form"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"

export default async function ClientSignPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, "sign")

  return (
    <div className="space-y-6 mx-auto max-w-lg">
      <div>
        <h2 className="text-2xl font-bold">Signature</h2>
        <p className="mt-1 text-muted-foreground">
          Confirm this agreement to continue to the payment or completion step.
        </p>
      </div>

      <ClientSignForm token={token} />
    </div>
  )
}
