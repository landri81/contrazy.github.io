"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, FileText, Landmark, ShieldCheck, Signature } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import {
  faqItems,
  heroStats,
  productModules,
  trustSignals,
  useCases,
  workflowSteps,
} from "@/content/site"
import { FaqAccordion } from "@/features/marketing/components/faq-accordion"
import { PricingSection } from "@/features/marketing/components/pricing-section"
import { FeatureGrid, StatGrid } from "@/features/marketing/components/content-pages"

export function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[var(--contrazy-navy)] px-5 pb-20 pt-16 text-white lg:px-10 lg:pb-24 lg:pt-24">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-0 size-[420px] rounded-full bg-[var(--contrazy-teal)]/20 blur-[120px]"
          animate={{ y: [0, 18, 0], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 bottom-0 size-[480px] rounded-full bg-[#1f4068]/40 blur-[140px]"
          animate={{ y: [0, -16, 0], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <FadeIn>
            
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl"
            >
              Contract, KYC, signature, deposit, and payment in one secure vendor flow.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-2xl text-base leading-8 text-white/65"
            >
              Conntrazy brings together client onboarding, optional identity verification, document collection, contract handling, signature, and payment into one linked transaction journey.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                href="/register"
                className={buttonVariants({
                  className: "group h-11 bg-[var(--contrazy-teal)] px-5 text-white hover:bg-[#0eb8a0]",
                })}
              >
                Start vendor setup
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/demo"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 border-white/20 bg-white/6 px-5 text-white hover:bg-white/10 hover:text-white",
                })}
              >
                View product preview
              </Link>
            </motion.div>
          </FadeIn>

          <Stagger className="grid gap-3 sm:grid-cols-2">
            {heroStats.map((stat) => (
              <StaggerItem
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors hover:bg-white/10"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-white">{stat.value}</p>
                <p className="mt-2 text-sm leading-7 text-white/55">{stat.detail}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-b border-border bg-background px-5 py-6 lg:px-10">
        <Stagger
          className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-4 lg:gap-10"
          staggerChildren={0.06}
        >
          {trustSignals.map((signal) => (
            <StaggerItem key={signal} y={6} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-[var(--contrazy-teal)]" />
              <span>{signal}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <FadeIn className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">Workflow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
              One transaction record, one client link, one operational view
            </h2>
            <p className="mt-4 text-sm leading-8 text-muted-foreground">
              Conntrazy keeps business setup, customer steps, agreements, and payments connected so teams do not lose context across tools.
            </p>
          </FadeIn>

          <Stagger className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-6">
            {workflowSteps.map((step) => (
              <StaggerItem key={step.step} className="bg-card p-6 transition-colors hover:bg-muted/40">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{step.step}</p>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <FeatureGrid
        eyebrow="Platform"
        title="Built for real business workflows"
        description="Every part of the Conntrazy experience is designed to support day-to-day use from the start."
        items={productModules}
      />

      <section className="bg-[var(--contrazy-bg-muted)] px-5 py-20 lg:px-10">
        <Stagger className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-4">
          {[
            {
              title: "Identity",
              icon: ShieldCheck,
              description: "Identity checks can be requested when the business needs extra confidence before approval or handover.",
            },
            {
              title: "Documents",
              icon: FileText,
              description: "Requested files stay clear for the customer and visible for the team handling the workflow.",
            },
            {
              title: "Signature",
              icon: Signature,
              description: "Agreement review and signature stay linked to the same customer record.",
            },
            {
              title: "Payments",
              icon: Landmark,
              description: "Service payments and deposits remain visible next to progress, issues, and follow-up actions.",
            },
          ].map((item) => (
            <StaggerItem
              key={item.title}
              className="group rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] transition-colors group-hover:bg-[var(--contrazy-teal)]/20">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <FeatureGrid
        eyebrow="Use Cases"
        title="Built for vendor-to-client workflows across multiple verticals"
        description="The same flow can support rentals, hospitality, property, and service-based businesses with only light adjustments."
        items={useCases}
      />

      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <FadeIn className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">Highlights</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Structured for scale from the first phase</h2>
            <p className="mt-4 text-sm leading-8 text-muted-foreground">
              Vendors, internal reviewers, and customers each get a dedicated experience without losing the consistency of one shared platform.
            </p>
          </FadeIn>
          <div className="mt-10">
            <StatGrid stats={heroStats} />
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.4fr]">
          <FadeIn>
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Common questions before launch</h2>
            <p className="mt-4 text-sm leading-8 text-muted-foreground">
              Here are the main questions teams ask before opening vendor accounts and sending their first customer links.
            </p>
            <div className="mt-8">
              <Link href="/faq" className={buttonVariants({ variant: "outline", className: "group h-10" })}>
                Full FAQ
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <FaqAccordion items={faqItems} />
          </FadeIn>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0c1e2f,#132d46)] px-5 py-20 text-white lg:px-10">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-[var(--contrazy-teal)]/15 blur-3xl"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <FadeIn className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">Ready to build</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Launch with one connected workflow from business setup to customer payment.
            </h2>
            <p className="mt-4 text-sm leading-8 text-white/65">
              Start with secure sign-in, business review, and a guided customer journey that grows with each next phase.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className={buttonVariants({
                className: "group h-10 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
              })}
            >
              Open app
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/api-docs"
              className={buttonVariants({
                variant: "outline",
                className: "h-10 border-white/20 bg-white/6 text-white hover:bg-white/10 hover:text-white",
              })}
            >
              View platform guide
            </Link>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
