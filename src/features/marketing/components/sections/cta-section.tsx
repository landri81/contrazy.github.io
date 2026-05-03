"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { FadeIn } from "@/components/ui/motion"

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0c1e2f,#132d46)] px-5 py-20 text-center text-white lg:px-10">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute right-[10%] top-[-100px] size-[300px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(17,201,176,.10), transparent 70%)" }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <FadeIn className="relative mx-auto max-w-xl">
        <h2 className="font-heading text-[30px] font-bold text-white">
          Prêt à sécuriser vos transactions ?
        </h2>
        <p className="mx-auto mt-3.5 max-w-[400px] text-[15px] leading-[1.7] text-white/50">
          Créez votre compte en 2 minutes. Aucune CB requise pendant l&apos;essai.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className={buttonVariants({
              className: "group h-12 bg-[var(--contrazy-teal)] px-7 text-white hover:bg-[#0eb8a0]",
            })}
          >
            Essai gratuit 7 jours
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </FadeIn>
    </section>
  )
}
