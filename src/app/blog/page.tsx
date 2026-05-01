import type { Metadata } from "next"

import { blogPosts } from "@/content/site"
import { PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Blog | Conntrazy",
  description: "Product updates, workflow guidance, and launch notes from Conntrazy.",
}

export default function BlogPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Blog"
        title="Product updates and workflow notes"
        description="Read about customer onboarding, account review, payments, and launch decisions across the Conntrazy rollout."
      />
      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <article key={post.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--contrazy-teal)] uppercase">
                {post.category}
              </p>
              <h2 className="mt-4 text-xl font-semibold text-foreground">{post.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.description}</p>
              <p className="mt-6 text-xs text-muted-foreground">{post.date}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  )
}
