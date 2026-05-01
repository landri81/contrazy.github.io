import type { Metadata } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { AuthLayout } from "@/features/auth/components/auth-layout"

export const metadata: Metadata = {
  title: "Verify Email | Conntrazy",
  description: "Verify your email for Conntrazy account access.",
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Check your inbox for the latest message and continue from the secure link."
    >
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <p>If email confirmation is required for your account, use the latest message we sent to complete sign-in.</p>
        <Link
          href="/login"
          className={buttonVariants({
            className: "mt-5 h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
          })}
        >
          Return to login
        </Link>
      </div>
    </AuthLayout>
  )
}
