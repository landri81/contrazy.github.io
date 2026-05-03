import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"

export default async function TokenIndexPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(`/t/${token}/cancelled`)
  }

  redirect(`/t/${token}/${getNextClientStep(transaction)}`)
}
