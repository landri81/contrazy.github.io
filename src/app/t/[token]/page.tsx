import { redirect } from "next/navigation"

export default async function TokenIndexPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/t/${token}/profile`)
}
