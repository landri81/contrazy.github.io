"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { workflowStepArtwork } from "@/features/marketing/section-artwork"
import { useTranslations } from "next-intl"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type WorkflowStep = {
  n: string
  title: string
  desc: string
}

export function WorkflowSection() {
  const t = useTranslations("marketing.workflow")
  const steps = t.raw("steps") as WorkflowStep[]

  const containerRef = useRef<HTMLDivElement>(null)

  // Refined scroll tracking for the right column
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  })

  const activeLineHeight = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  return (
    <section className="bg-background py-20 lg:py-32 border-b border-border/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-32">

          {/* Left Side: Clean, High-End Typography */}
          <div className="lg:sticky lg:top-40">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-6 bg-teal-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-600">
                {t("eyebrow")}
              </span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground lg:text-6xl lg:leading-[1.1]">
              {t("titleBefore")}{" "}
              <span className="text-teal-600 italic font-serif">{t("titleEmphasis")}</span>
            </h2>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground">
              {t("description")}
            </p>

            {/* Simplified, Professional CTA */}
            <div className="mt-12 flex flex-col items-start gap-4">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-teal-600 text-white hover:bg-teal-700 rounded-full px-8"
                )}
              >
                {t("ctaButton")}
                <ArrowRight className="ml-2 size-4" />
              </Link>
              <p className="text-xs text-muted-foreground ml-2 italic">
                {t("ctaTitle")} — {t("ctaDescription")}
              </p>
            </div>
          </div>

          {/* Right Side: Scroll-Triggered Audit Trail */}
          <div ref={containerRef} className="relative py-10">
            {/* The Connecting Line (Track) */}
            <div className="absolute left-4 top-0 h-full w-px bg-border/40" />

            {/* The Progress Line (Active) */}
            <motion.div
              className="absolute left-4 top-0 w-px bg-teal-500 origin-top shadow-[0_0_12px_rgba(20,184,166,0.6)]"
              style={{ scaleY: activeLineHeight }}
            />

            <div className="space-y-10">
              {steps.map((step, i) => (
                <StepItem key={step.n} step={step} index={i} progress={scrollYProgress} totalSteps={steps.length} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

function StepItem({
  step,
  index,
  progress,
  totalSteps,
}: {
  step: WorkflowStep
  index: number
  progress: MotionValue<number>
  totalSteps: number
}) {
  // Define the "activation window" for this specific step
  const start = index / totalSteps
  const end = (index + 1) / totalSteps

  // Map scroll progress to local styles
  const opacity = useTransform(progress, [start, end], [0.4, 1])
  const scale = useTransform(progress, [start, end], [0.98, 1])
  const borderColor = useTransform(progress, [start, end], ["rgba(226, 232, 240, 0.4)", "rgba(20, 184, 166, 0.3)"])

  return (
    <motion.div
      style={{ opacity, scale }}
      className="relative pl-12 group"
    >
      {/* Node Dot that lights up */}
      <motion.div
        className="absolute left-[12.5px] top-6 z-10 size-2.5 rounded-full border-2 border-background shadow-sm"
        style={{
          backgroundColor: useTransform(progress, [start, end], ["#e2e8f0", "#14b8a6"]),
          scale: useTransform(progress, [start, end], [1, 1.4])
        }}
      />

      <motion.div
        style={{ borderColor }}
        className="relative flex items-center gap-6 overflow-hidden rounded-2xl border bg-card/50 p-5 backdrop-blur-sm transition-shadow hover:shadow-lg hover:shadow-black/[0.02]"
      >
        {/* Artwork that goes from grayscale to color on scroll */}
        <motion.div
          className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted/30 p-3"
          style={{ filter: useTransform(progress, [start, end], ["grayscale(100%)", "grayscale(0%)"]) }}
        >
          <Image
            src={workflowStepArtwork[index] ?? workflowStepArtwork[workflowStepArtwork.length - 1]}
            alt={step.title}
            fill
            className="object-contain"
          />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[15px] font-bold text-foreground">
              {step.title}
            </h4>
            <span className="font-mono text-[9px] text-muted-foreground/50 tracking-tighter">
              {step.n.padStart(2, '0')}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground/80 line-clamp-2">
            {step.desc}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
