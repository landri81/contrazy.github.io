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
    <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Sign Agreement</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Draw your signature to confirm this agreement electronically.
        </p>
      </div>

      <ClientSignForm token={token} />
    </div>
  )
}
