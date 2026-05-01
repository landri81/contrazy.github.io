import { redirect } from "next/navigation"

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

  redirect(`/t/${token}/${getNextClientStep(transaction)}`)
}
