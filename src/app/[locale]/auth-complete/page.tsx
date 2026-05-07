import { redirect } from "next/navigation"

import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export const dynamic = "force-dynamic"

export default async function AuthCompletePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const session = await getAuthSession()

  redirect(withLocalePath(locale, getRoleHomePath(session?.user?.role)))
}
