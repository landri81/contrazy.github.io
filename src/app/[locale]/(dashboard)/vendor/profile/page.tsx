export const dynamic = "force-dynamic"

import { getTranslations } from "next-intl/server"
import { PagePanel } from "@/features/dashboard/components/dashboard-ui"
import { VendorProfileForm } from "@/features/dashboard/components/vendor-profile-form"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorProfilePage() {
  const t = await getTranslations("dashboard.vendor.profile")
  const { dbUser, vendorProfile } = await requireVendorProfileAccess()
  const vendorProfileWithLogo = vendorProfile as typeof vendorProfile & {
    businessLogoUrl?: string | null
    businessLogoPublicId?: string | null
    businessLogoFileName?: string | null
  }
  const accountEmail = dbUser.email
  const profileKey = [
    vendorProfile.ownerFirstName ?? "",
    vendorProfile.ownerLastName ?? "",
    accountEmail,
    vendorProfile.businessName ?? "",
    vendorProfile.supportEmail ?? "",
    vendorProfile.businessPhone ?? "",
    vendorProfile.businessAddress ?? "",
    vendorProfile.businessCountry ?? "",
    vendorProfile.registrationNumber ?? "",
    vendorProfile.vatNumber ?? "",
    vendorProfile.preferredLocale,
    vendorProfile.reviewStatus,
    vendorProfile.stripeConnectionStatus,
    vendorProfileWithLogo.businessLogoUrl ?? "",
    vendorProfileWithLogo.businessLogoPublicId ?? "",
    vendorProfileWithLogo.businessLogoFileName ?? "",
  ].join("|")

  return (
    <PagePanel
      title={t("title")}
      description={t("description")}
    >
      <VendorProfileForm
        key={profileKey}
        initialValues={{
          ownerFirstName: vendorProfile.ownerFirstName ?? "",
          ownerLastName: vendorProfile.ownerLastName ?? "",
          businessName: vendorProfile.businessName ?? "",
          businessEmail: accountEmail,
          supportEmail: vendorProfile.supportEmail ?? "",
          businessPhone: vendorProfile.businessPhone ?? "",
          businessAddress: vendorProfile.businessAddress ?? "",
          businessCountry: vendorProfile.businessCountry ?? "",
          registrationNumber: vendorProfile.registrationNumber ?? "",
          vatNumber: vendorProfile.vatNumber ?? "",
          businessLogoUrl: vendorProfileWithLogo.businessLogoUrl ?? "",
          businessLogoPublicId: vendorProfileWithLogo.businessLogoPublicId ?? "",
          businessLogoFileName: vendorProfileWithLogo.businessLogoFileName ?? "",
          preferredLocale: vendorProfile.preferredLocale,
          reviewStatus: vendorProfile.reviewStatus,
          stripeConnectionStatus: vendorProfile.stripeConnectionStatus,
        }}
        accountEmail={accountEmail}
      />
    </PagePanel>
  )
}
