import { PagePanel } from "@/features/dashboard/components/dashboard-ui"
import { VendorProfileForm } from "@/features/dashboard/components/week-one-forms"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorProfilePage() {
  const { dbUser } = await requireVendorAccess()

  if (!dbUser) {
    return null
  }

  return (
    <PagePanel
      title="Business profile"
      description="Complete your business details so your account can be reviewed and prepared for live use."
    >
      <VendorProfileForm
        initialValues={{
          fullName: dbUser.name ?? "",
          businessName: dbUser.vendorProfile?.businessName ?? "",
          businessEmail: dbUser.vendorProfile?.businessEmail ?? dbUser.email,
          supportEmail: dbUser.vendorProfile?.supportEmail ?? "",
          businessPhone: dbUser.vendorProfile?.businessPhone ?? "",
          businessAddress: dbUser.vendorProfile?.businessAddress ?? "",
          businessCountry: dbUser.vendorProfile?.businessCountry ?? "",
          reviewStatus: dbUser.vendorProfile?.reviewStatus ?? "PENDING",
          stripeConnectionStatus: dbUser.vendorProfile?.stripeConnectionStatus ?? "NOT_CONNECTED",
        }}
      />
    </PagePanel>
  )
}
