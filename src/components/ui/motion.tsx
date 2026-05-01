"use client"

import { motion, type HTMLMotionProps, type Transition } from "framer-motion"
import { forwardRef } from "react"

const defaultTransition: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
}

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number
  y?: number
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(function FadeIn(
  { delay = 0, y = 12, transition, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...defaultTransition, delay, ...transition }}
      {...rest}
    />
  )
})

type StaggerProps = HTMLMotionProps<"div"> & {
  delayChildren?: number
  staggerChildren?: number
}

export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(function Stagger(
  { delayChildren = 0.05, staggerChildren = 0.08, transition, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren,
            staggerChildren,
            ...transition,
          },
        },
      }}
      {...rest}
    />
  )
})

type StaggerItemProps = HTMLMotionProps<"div"> & {
  y?: number
}

export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(function StaggerItem(
  { y = 16, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: defaultTransition },
      }}
      {...rest}
    />
  )
})

type StepFadeProps = HTMLMotionProps<"div">

export const StepFade = forwardRef<HTMLDivElement, StepFadeProps>(function StepFade(
  { transition, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ ...defaultTransition, ...transition }}
      {...rest}
    />
  )
})
