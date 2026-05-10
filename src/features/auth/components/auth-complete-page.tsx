"use client"

import { getSession } from "next-auth/react"
import { useEffect } from "react"

import { AuthCompleteLoadingState } from "@/features/auth/components/auth-complete-loading-state"
import { useRouter } from "@/i18n/navigation"
import { getRoleHomePath } from "@/lib/auth/pathing"

export function AuthCompletePage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function resolveDestination() {
      try {
        const session = await getSession()

        if (cancelled) {
          return
        }

        router.replace(getRoleHomePath(session?.user?.role))
      } catch (error) {
        console.error("Auth complete redirect failed", error)

        if (cancelled) {
          return
        }

        router.replace("/login")
      }
    }

    void resolveDestination()

    return () => {
      cancelled = true
    }
  }, [router])

  return <AuthCompleteLoadingState />
}
