"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Send, Archive } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

async function patchContact(contactId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<{ success: boolean; message?: string }>
}

export function AdminContactReplyForm({
  contactId,
  isReplied,
}: {
  contactId: string
  isReplied: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [replyText, setReplyText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await patchContact(contactId, { action: "reply", replyText: replyText.trim() })
      if (result.success) {
        setDone(true)
        router.refresh()
      } else {
        setError(result.message ?? "Failed to send reply")
      }
    })
  }

  async function handleArchive() {
    setError(null)
    startTransition(async () => {
      const result = await patchContact(contactId, { action: "archive" })
      if (result.success) {
        router.refresh()
      } else {
        setError(result.message ?? "Failed to archive message")
      }
    })
  }

  if (done) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Reply sent successfully.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isReplied && (
        <form onSubmit={handleReply} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reply-text">Reply message</Label>
            <Textarea
              id="reply-text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply here…"
              className="min-h-36"
              required
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending || !replyText.trim()}
              className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
            >
              <Send className="size-4" />
              {isPending ? "Sending…" : "Send reply"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleArchive}
            >
              <Archive className="size-4" />
              Archive
            </Button>
          </div>
        </form>
      )}

      {isReplied && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleArchive}
          >
            <Archive className="size-4" />
            Archive
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

export function MarkReadOnMount({ contactId }: { contactId: string }) {
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/admin/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read" }),
    }).then(() => router.refresh()).catch(() => { /* non-blocking */ })
  }, [contactId, router])

  return null
}
