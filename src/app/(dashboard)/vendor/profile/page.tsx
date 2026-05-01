import { PagePanel } from "@/features/dashboard/components/dashboard-ui"
import { VendorProfileForm } from "@/features/dashboard/components/week-one-forms"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorProfilePage() {
  const { dbUser, vendorProfile } = await requireVendorProfileAccess()

  return (
    <PagePanel
      title="Business profile"
      description="Complete your business details so your account can be reviewed and prepared for live use."
    >
      <VendorProfileForm
        initialValues={{
          fullName: dbUser.name ?? "",
          businessName: vendorProfile.businessName ?? "",
          businessEmail: vendorProfile.businessEmail ?? dbUser.email,
          supportEmail: vendorProfile.supportEmail ?? "",
          businessPhone: vendorProfile.businessPhone ?? "",
          businessAddress: vendorProfile.businessAddress ?? "",
          businessCountry: vendorProfile.businessCountry ?? "",
          reviewStatus: vendorProfile.reviewStatus,
          stripeConnectionStatus: vendorProfile.stripeConnectionStatus,
        }}
      />
    </PagePanel>
  )
}
