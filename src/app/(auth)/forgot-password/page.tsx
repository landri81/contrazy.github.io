import type { Metadata } from "next"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = {
  title: "Forgot Password | Conntrazy",
  description: "Request a password reset link for your Conntrazy account.",
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset account access"
      subtitle="Enter the email address used for your account and we will send the next steps."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
