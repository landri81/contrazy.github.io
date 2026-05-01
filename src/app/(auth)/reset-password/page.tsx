import type { Metadata } from "next"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export const metadata: Metadata = {
  title: "Reset Password | Conntrazy",
  description: "Reset your Conntrazy account password.",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use the link from your email to choose a new password."
    >
      <ResetPasswordForm token={token} />
    </AuthLayout>
  )
}
