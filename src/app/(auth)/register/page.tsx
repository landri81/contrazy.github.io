import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { RegisterForm } from "@/features/auth/components/register-form"
import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Register | Conntrazy",
  description: "Create a vendor account for Conntrazy.",
}

export default async function RegisterPage() {
  const session = await getAuthSession()

  if (session?.user?.role) {
    redirect(getRoleHomePath(session.user.role))
  }

  return (
    <AuthLayout
      title="Create vendor account"
      subtitle="Open your workspace, save your business details, and prepare for account review."
    >
      <RegisterForm />
    </AuthLayout>
  )
}
