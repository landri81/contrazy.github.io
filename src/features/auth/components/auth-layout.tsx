import Link from "next/link"

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[420px_1fr]">
      <aside className="hidden border-r border-white/10 bg-[var(--contrazy-navy)] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            Con<span className="text-[var(--contrazy-teal)]">trazy</span>
          </Link>
          <p className="mt-12 max-w-xs text-xl font-semibold leading-snug">
            Contract, KYC, signature, deposit and payment in one secure flow.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/70">
            <li>Business setup and approval in one place</li>
            <li>Customer agreements, documents, and identity checks</li>
            <li>Payments and deposits with clear follow-up steps</li>
          </ul>
        </div>
        <p className="text-xs text-white/45">Secure sign-in for vendors, admins, and account owners</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
