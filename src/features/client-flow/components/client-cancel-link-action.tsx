"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

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
        setError(payload?.message ?? "Unable to cancel this request right now.")
        return
      }

      router.replace(payload?.redirectUrl ?? `/t/${token}/cancelled`)
      router.refresh()
    } catch (err) {
      console.error(err)
      setError("Unable to cancel this request right now.")
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
        className="border-white/15 bg-white/8 text-white hover:bg-white/12 hover:text-white"
        onClick={() => setOpen(true)}
      >
        <XCircle className="size-3.5" />
        Cancel request
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this secure request?</DialogTitle>
            <DialogDescription>
              This will close the link immediately. You will not be able to continue the workflow after cancellation.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Keep request
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
