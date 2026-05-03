"use client"

import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export type ToastVariant = "success" | "error" | "warning" | "info"

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
}

// Module-level event bus — no React context needed
const listeners = new Set<(t: ToastItem) => void>()

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function toast(opts: Omit<ToastItem, "id">) {
  const item: ToastItem = { ...opts, id: uid() }
  listeners.forEach((fn) => fn(item))
}

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bg: string; border: string; text: string }
> = {
  success: {
    icon: <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-100",
  },
  error: {
    icon: <XCircle className="size-4 shrink-0 text-red-600" />,
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-900 dark:text-red-100",
  },
  warning: {
    icon: <AlertTriangle className="size-4 shrink-0 text-amber-600" />,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-100",
  },
  info: {
    icon: <Info className="size-4 shrink-0 text-blue-600" />,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
  },
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setToasts((prev) => [...prev, item])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id))
      }, item.duration ?? 4500)
    }
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] flex w-full max-w-sm flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const cfg = variantConfig[t.variant]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 shadow-lg ${cfg.bg} ${cfg.border}`}
            >
              {cfg.icon}
              <div className={`min-w-0 flex-1 ${cfg.text}`}>
                <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-[12px] opacity-75">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className={`shrink-0 opacity-40 transition-opacity hover:opacity-100 ${cfg.text}`}
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body
  )
}
