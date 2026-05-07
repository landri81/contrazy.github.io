"use client"

import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export function AdminDocumentDeleteButton({
  userId,
  linkId,
  documentId,
}: {
  userId: string
  linkId: string
  documentId: string
}) {
  const t = useTranslations("dashboard.admin.vendorManager.documents")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!window.confirm(t("confirmDelete"))) {
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/users/${userId}/links/${linkId}/documents/${documentId}`,
          { method: "DELETE" }
        )

        const payload = await response.json()

        if (!response.ok) {
          setError(payload.message ?? t("deleteFailed"))
          return
        }

        router.refresh()
      } catch {
        setError(t("deleteFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        <span className="sr-only">{t("delete")}</span>
      </Button>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
