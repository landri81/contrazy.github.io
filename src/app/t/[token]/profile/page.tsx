import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientProfileForm } from "@/features/client-flow/components/client-pages"

export default async function ClientProfilePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'profile')

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Step 1 - Contact details
        </div>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          Tell us who is completing this request
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          We use these details to prepare the agreement, payment receipt, and secure transaction updates.
        </p>
      </div>

      <ClientProfileForm 
        token={token} 
        initialData={transaction.clientProfile}
      />
    </div>
  )
}
