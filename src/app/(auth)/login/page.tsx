import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"
import { getRoleHomePath } from "@/lib/auth/pathing"
import { getAuthSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Connexion | Contrazy",
  description: "Accédez à votre espace vendeur Contrazy.",
}

export default async function LoginPage() {
  const session = await getAuthSession()

  if (session?.user?.role) {
    redirect(getRoleHomePath(session.user.role))
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à votre espace vendeur"
    >
      <LoginForm />
    </AuthLayout>
  )
}
