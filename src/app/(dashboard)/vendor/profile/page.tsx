export const dynamic = "force-dynamic"

import { PagePanel } from "@/features/dashboard/components/dashboard-ui"
import { VendorProfileForm } from "@/features/dashboard/components/vendor-profile-form"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorProfilePage() {
  const { dbUser, vendorProfile } = await requireVendorProfileAccess()
  const accountEmail = dbUser.email
  const profileKey = [
    dbUser.name ?? "",
    accountEmail,
    vendorProfile.businessName ?? "",
    vendorProfile.supportEmail ?? "",
    vendorProfile.businessPhone ?? "",
    vendorProfile.businessAddress ?? "",
    vendorProfile.businessCountry ?? "",
    vendorProfile.reviewStatus,
    vendorProfile.stripeConnectionStatus,
  ].join("|")

  return (
    <PagePanel
      title="Business profile"
      description="Review your business details, workspace status, and update only the fields that need changes."
    >
      <VendorProfileForm
        key={profileKey}
        initialValues={{
          fullName: dbUser.name ?? "",
          businessName: vendorProfile.businessName ?? "",
          businessEmail: accountEmail,
          supportEmail: vendorProfile.supportEmail ?? "",
          businessPhone: vendorProfile.businessPhone ?? "",
          businessAddress: vendorProfile.businessAddress ?? "",
          businessCountry: vendorProfile.businessCountry ?? "",
          reviewStatus: vendorProfile.reviewStatus,
          stripeConnectionStatus: vendorProfile.stripeConnectionStatus,
        }}
        accountEmail={accountEmail}
      />
    </PagePanel>
  )
}
