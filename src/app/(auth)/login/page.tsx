import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"
import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Login | Conntrazy",
  description: "Sign in to Conntrazy vendor, admin, or super admin account.",
}

export default async function LoginPage() {
  const session = await getAuthSession()

  if (session?.user?.role) {
    redirect(getRoleHomePath(session.user.role))
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue with your business setup, customer workflows, and account review."
    >
      <LoginForm />
    </AuthLayout>
  )
}
