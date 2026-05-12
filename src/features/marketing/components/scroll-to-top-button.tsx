"use client"

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { ArrowUp } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

const BUTTON_SIZE = 56
const RING_RADIUS = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function ScrollToTopButton() {
  const t = useTranslations("site.scrollToTop")
  const prefersReducedMotion = useReducedMotion()
  const { scrollY, scrollYProgress } = useScroll()
  const [threshold, setThreshold] = useState(420)
  const [isVisible, setIsVisible] = useState(false)
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.32,
  })
  const progressOffset = useTransform(progress, [0, 1], [RING_CIRCUMFERENCE, 0])

  useEffect(() => {
    const updateThreshold = () => {
      setThreshold(Math.max(260, Math.round(window.innerHeight * 0.7)))
    }

    updateThreshold()
    window.addEventListener("resize", updateThreshold)

    return () => {
      window.removeEventListener("resize", updateThreshold)
    }
  }, [])

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsVisible(latest > threshold)
  })

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.9, filter: "blur(8px)" }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.94, filter: "blur(6px)" }}
          transition={{ duration: prefersReducedMotion ? 0.16 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-40"
          style={{
            bottom: "max(1rem, env(safe-area-inset-bottom))",
            right: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <motion.button
            type="button"
            aria-label={t("label")}
            title={t("label")}
            whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.03 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? "auto" : "smooth",
              })
            }}
            className="group relative isolate flex cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white/90 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-colors hover:border-[rgb(17_201_176/0.28)] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(17_201_176/0.14)]"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(255,255,255,0.68))]" />
            <span className="absolute inset-[3px] rounded-full border border-slate-900/[0.05]" />

            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="absolute inset-1 -rotate-90"
            >
              <circle
                cx="24"
                cy="24"
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(15, 23, 42, 0.08)"
                strokeWidth="2.5"
              />
              <motion.circle
                cx="24"
                cy="24"
                r={RING_RADIUS}
                fill="none"
                stroke="rgb(17, 201, 176)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                style={{ strokeDashoffset: progressOffset }}
              />
            </svg>

            <motion.span
              aria-hidden="true"
              animate={prefersReducedMotion ? undefined : { y: [0, -1.5, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 1.2 }
              }
              className="relative z-10 flex size-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(235,250,246,0.9))] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            >
              <ArrowUp className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5" />
            </motion.span>

            <span className="sr-only">{t("label")}</span>
          </motion.button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
