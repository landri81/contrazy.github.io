import Link from "next/link"

import { footerGroups } from "@/content/site"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[var(--contrazy-navy)] text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_repeat(3,1fr)] lg:px-10">
        <div>
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            Con<span className="text-[var(--contrazy-teal)]">trazy</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
            Contract, identity checks, signature, deposit, and payment in one secure workflow for vendor teams and their customers.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/60">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  )
}
