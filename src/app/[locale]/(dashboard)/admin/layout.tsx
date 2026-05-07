import { getTranslations } from "next-intl/server"

import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { buildAdminNavigation } from "@/features/dashboard/navigation"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await requireAdminAccess()
  const t = await getTranslations("dashboard")
  const tFn = (key: string) => t(key as never)
  const navigation = buildAdminNavigation(tFn)

  return (
    <DashboardShell
      navigation={navigation}
      title={t("admin.workspace.title")}
      subtitle={t("admin.workspace.subtitle")}
      actorLabel={t("admin.workspace.actorLabel")}
      account={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        role: session.user.role ?? null,
      }}
    >
      {children}
    </DashboardShell>
  )
}
