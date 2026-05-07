"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Loader2, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ClientCancelLinkAction({ token }: { token: string }) {
  const t = useTranslations("clientFlow.cancelLink")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setIsPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/client/${token}/cancel`, {
        method: "POST",
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? t("error"))
        return
      }

      router.replace(payload?.redirectUrl ?? `/t/${token}/cancelled`)
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(t("error"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
        onClick={() => setOpen(true)}
      >
        <XCircle className="size-3.5" />
        {t("trigger")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description")}
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("keepRequest")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
