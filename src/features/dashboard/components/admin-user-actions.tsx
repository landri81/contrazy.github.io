"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { formatValueLabel } from "@/features/dashboard/lib/format-value-label"

const REVIEW_ACTIONS = [
  {
    status: "APPROVED" as const,
    label: "Approve",
    activeLabel: "Approved",
    activeCls: "bg-emerald-600 border-emerald-600 text-white",
    idleCls: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  },
  {
    status: "PENDING" as const,
    label: "Mark pending",
    activeLabel: "Pending",
    activeCls: "bg-amber-500 border-amber-500 text-white",
    idleCls: "border-amber-300 text-amber-700 hover:bg-amber-50",
  },
  {
    status: "REJECTED" as const,
    label: "Reject",
    activeLabel: "Rejected",
    activeCls: "bg-red-600 border-red-600 text-white",
    idleCls: "border-red-300 text-red-700 hover:bg-red-50",
  },
  {
    status: "SUSPENDED" as const,
    label: "Suspend",
    activeLabel: "Suspended",
    activeCls: "bg-slate-600 border-slate-600 text-white",
    idleCls: "border-slate-300 text-slate-700 hover:bg-slate-50",
  },
] as const

export function VendorReviewActions({
  userId,
  currentStatus,
}: {
  userId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [localStatus, setLocalStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function updateStatus(reviewStatus: "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING") {
    if (reviewStatus === localStatus) return
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewStatus }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Unable to update review status.")
          return
        }

        setLocalStatus(reviewStatus)
        router.refresh()
      } catch {
        setError("Unable to update review status right now.")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {REVIEW_ACTIONS.map((action) => {
          const isActive = localStatus === action.status
          return (
            <button
              key={action.status}
              type="button"
              disabled={isActive || isPending}
              onClick={() => updateStatus(action.status)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-70 ${
                isActive ? action.activeCls : action.idleCls
              }`}
            >
              {isPending && isActive ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {isActive ? action.activeLabel : action.label}
              {isActive ? <span className="text-xs opacity-80">· current</span> : null}
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "VENDOR", label: "Vendor", description: "Workspace access for running customer workflows." },
  { value: "ADMIN", label: "Admin", description: "Internal team access for vendor review and platform management." },
  { value: "SUPER_ADMIN", label: "Super Admin", description: "Full platform control. Assign carefully." },
]

export function UserRoleActions({
  userId,
  currentRole,
}: {
  userId: string
  currentRole: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function changeRole(role: string) {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Unable to update role.")
          return
        }

        setMessage(`Role updated to ${formatValueLabel(role)}.`)
        router.refresh()
      } catch {
        setError("Unable to update role right now.")
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Current role: <span className="font-medium text-foreground">{formatValueLabel(currentRole)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={isPending || option.value === currentRole}
            onClick={() => changeRole(option.value)}
            className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              option.value === currentRole
                ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)]/5 text-foreground"
                : "border-border bg-background hover:border-[var(--contrazy-teal)]/50 hover:bg-muted/50"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
              {option.label}
              {option.value === currentRole ? (
                <span className="ml-auto rounded-full bg-[var(--contrazy-teal)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--contrazy-teal)] uppercase tracking-wide">
                  Current
                </span>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        ) : null}
        {message ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-emerald-600"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function UserDeleteAction({
  userId,
  userEmail,
}: {
  userId: string
  userEmail: string
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmValue, setConfirmValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canDelete = confirmValue.trim().toLowerCase() === userEmail.trim().toLowerCase()

  async function handleDelete() {
    if (!canDelete) return
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Unable to delete user.")
          return
        }

        router.push("/admin/users")
        router.refresh()
      } catch {
        setError("Unable to delete the account right now.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => setIsOpen(true)}
        >
          Delete account
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-sm font-medium text-red-800">This action is permanent and cannot be undone.</p>
            <p className="mt-1 text-sm text-red-700">
              Type <span className="font-mono font-semibold">{userEmail}</span> below to confirm.
            </p>
          </div>
          <input
            type="text"
            value={confirmValue}
            onChange={(event) => setConfirmValue(event.target.value)}
            placeholder={userEmail}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-400"
            autoComplete="off"
          />
          <div className="flex gap-3">
            <Button
              type="button"
              disabled={!canDelete || isPending}
              onClick={handleDelete}
              className="h-9 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Permanently delete
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                setIsOpen(false)
                setConfirmValue("")
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      )}
    </div>
  )
}

const REVIEW_STATUS_CONFIG = {
  APPROVED: { label: "Approved", dot: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  PENDING: { label: "Pending", dot: "bg-amber-500", badge: "text-amber-700 bg-amber-50 border-amber-200" },
  REJECTED: { label: "Rejected", dot: "bg-red-500", badge: "text-red-700 bg-red-50 border-red-200" },
  SUSPENDED: { label: "Suspended", dot: "bg-slate-400", badge: "text-slate-700 bg-slate-100 border-slate-200" },
} as const

type ReviewStatus = keyof typeof REVIEW_STATUS_CONFIG

export function VendorQuickReview({
  userId,
  currentStatus,
}: {
  userId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState(currentStatus)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function openDropdown() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const DROPDOWN_WIDTH = 148
    const DROPDOWN_HEIGHT = 140 // approximate: 4 options × ~35px
    const GAP = 4
    const EDGE = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Flip up if not enough space below
    const spaceBelow = viewportHeight - rect.bottom
    const openUpward = spaceBelow < DROPDOWN_HEIGHT + GAP && rect.top > DROPDOWN_HEIGHT + GAP

    // Right-align if would overflow right edge
    const left =
      rect.left + DROPDOWN_WIDTH > viewportWidth - EDGE
        ? Math.max(EDGE, rect.right - DROPDOWN_WIDTH)
        : rect.left

    const verticalStyle = openUpward
      ? { bottom: viewportHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }

    setDropdownStyle({ position: "fixed", left, minWidth: DROPDOWN_WIDTH, ...verticalStyle })
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        !dropdownRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    function onScrollOrResize() {
      setIsOpen(false)
    }

    document.addEventListener("mousedown", onClickOutside)
    window.addEventListener("scroll", onScrollOrResize, { capture: true })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      window.removeEventListener("scroll", onScrollOrResize, { capture: true })
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [isOpen])

  async function updateStatus(reviewStatus: ReviewStatus) {
    if (reviewStatus === localStatus) {
      setIsOpen(false)
      return
    }
    setError(null)
    setIsOpen(false)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewStatus }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? "Failed to update.")
          return
        }

        setLocalStatus(reviewStatus)
        router.refresh()
      } catch {
        setError("Request failed.")
      }
    })
  }

  const config = REVIEW_STATUS_CONFIG[localStatus as ReviewStatus] ?? REVIEW_STATUS_CONFIG.PENDING

  return (
    <>
      <div className="inline-block">
        <button
          ref={triggerRef}
          type="button"
          disabled={isPending}
          onClick={openDropdown}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${config.badge}`}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronDown className={`size-3 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
          )}
          {config.label}
        </button>
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </div>

      {isOpen
        ? createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="z-9999 rounded-lg border border-border bg-background py-1 shadow-lg"
            >
              {(Object.keys(REVIEW_STATUS_CONFIG) as ReviewStatus[]).map((status) => {
                const opt = REVIEW_STATUS_CONFIG[status]
                const isCurrent = status === localStatus
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateStatus(status)}
                    disabled={isCurrent}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${
                      isCurrent ? "" : "hover:bg-muted"
                    }`}
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${opt.dot}`} />
                    {opt.label}
                    {isCurrent ? (
                      <span className="ml-auto text-[10px] text-muted-foreground">current</span>
                    ) : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
