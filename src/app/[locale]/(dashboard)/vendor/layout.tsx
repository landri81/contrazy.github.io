import { getTranslations } from "next-intl/server"

import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { buildVendorNavigation, buildVendorSubscriptionNavigation } from "@/features/dashboard/navigation"
import { hasActiveSubscription } from "@/features/subscriptions/server/feature-gates"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, dbUser, vendorProfile, subscription } = await requireVendorProfileAccess()
  const vendorProfileWithLogo = vendorProfile as typeof vendorProfile & {
    businessLogoUrl?: string | null
  }
  const t = await getTranslations("dashboard")
  const tFn = (key: string) => t(key as never)
  const navigation = subscription && hasActiveSubscription(subscription)
    ? buildVendorNavigation(tFn)
    : buildVendorSubscriptionNavigation(tFn)

  return (
    <DashboardShell
      navigation={navigation}
      title={t("vendor.workspace.title")}
      subtitle={vendorProfile.businessName ?? t("vendor.workspace.defaultSubtitle")}
      actorLabel={t("vendor.workspace.actorLabel")}
      account={{
        name: dbUser.name ?? session.user.name ?? null,
        email: session.user.email ?? null,
        image: vendorProfileWithLogo.businessLogoUrl ?? null,
        role: session.user.role ?? null,
      }}
    >
      {children}
    </DashboardShell>
  )
}
