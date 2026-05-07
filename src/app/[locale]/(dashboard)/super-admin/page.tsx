import { redirect } from "next/navigation"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function SuperAdminLegacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  redirect(withLocalePath(normalizeLocale(rawLocale), "/admin"))
}
