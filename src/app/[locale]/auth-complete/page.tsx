import { AuthCompletePage as AuthCompleteClientPage } from "@/features/auth/components/auth-complete-page"
import { normalizeLocale } from "@/lib/i18n/locale-utils"

export const dynamic = "force-dynamic"

export default async function AuthCompleteRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  normalizeLocale(rawLocale)

  return <AuthCompleteClientPage />
}
