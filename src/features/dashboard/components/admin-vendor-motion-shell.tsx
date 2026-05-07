"use client"

import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

export function AdminVendorMotionShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
