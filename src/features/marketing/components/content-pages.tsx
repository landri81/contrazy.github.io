import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CircleCheck, LifeBuoy, Mail, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { ContentSection, FeatureCard, Stat } from "@/content/site"
import { ContactFormCard } from "@/features/marketing/components/contact-form-card"
import { FaqAccordion } from "@/features/marketing/components/faq-accordion"

export function PageHero({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
}) {
  return (
    <section className="bg-[var(--contrazy-navy)] px-5 py-20 text-white lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-7xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-8 text-white/65 sm:text-base">{description}</p>
        {primaryHref && primaryLabel ? (
          <div className="mt-8">
            <Link
              href={primaryHref}
              className={buttonVariants({
                className: "h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
              })}
            >
              {primaryLabel}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{stat.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function FeatureGrid({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string
  title: string
  description: string
  items: readonly FeatureCard[]
}) {
  return (
    <section className="px-5 py-20 lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-4 text-sm leading-8 text-muted-foreground">{description}</p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {item.image ? (
                <div className="relative aspect-[16/9] border-b border-border bg-white p-6 dark:bg-zinc-950">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-contain p-6"
                  />
                </div>
              ) : null}
              <div className="p-6">
                {item.tag ? <Badge variant="outline">{item.tag}</Badge> : null}
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProseSections({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string
  title: string
  description: string
  sections: readonly ContentSection[]
}) {
  return (
    <section className="px-5 py-20 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-4 text-sm leading-8 text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-8 rounded-xl border border-border bg-card p-6 sm:p-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-8 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm leading-7 text-muted-foreground">
                        <CircleCheck className="mt-1 size-4 shrink-0 text-[var(--contrazy-teal)]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FaqPageSection({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: readonly { question: string; answer: string }[]
}) {
  return (
    <section className="px-5 py-20 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-4 text-sm leading-8 text-muted-foreground">{description}</p>
        </div>
        <FaqAccordion items={items} />
      </div>
    </section>
  )
}

export function ContactSection({
  channels,
}: {
  channels: readonly { title: string; description: string }[]
}) {
  return (
    <section className="px-5 py-20 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          {channels.map((channel, index) => {
            const Icon = index === 0 ? Mail : index === 1 ? LifeBuoy : ShieldCheck

            return (
              <div key={channel.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <Icon className="size-5 text-[var(--contrazy-teal)]" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">{channel.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{channel.description}</p>
              </div>
            )
          })}
        </div>
        <ContactFormCard />
      </div>
    </section>
  )
}
