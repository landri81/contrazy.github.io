import type { Metadata } from "next"
import Link from "next/link"
import { CircleCheckBig } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { AuthLayout } from "@/features/auth/components/auth-layout"

export const metadata: Metadata = {
  title: "Signup Success | Conntrazy",
  description: "Registration success confirmation for Conntrazy.",
}

export default function SignupSuccessPage() {
  return (
    <AuthLayout
      title="Account created"
      subtitle="Your workspace is ready. Sign in to finish your business details and continue."
    >
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <CircleCheckBig className="mx-auto size-10 text-emerald-600" />
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Your account is ready. Continue to login to open the protected vendor workspace.
        </p>
        <Link
          href="/login"
          className={buttonVariants({
            className: "mt-5 h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
          })}
        >
          Go to login
        </Link>
      </div>
    </AuthLayout>
  )
}
