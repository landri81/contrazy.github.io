"use client"

import { useState } from "react"
import type { ContractTemplate } from "@prisma/client"
import {
  Braces,
  CalendarClock,
  Edit,
  FileText,
  Loader2,
  Plus,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const mergeFields = [
  { label: "Client name", token: "{{clientName}}" },
  { label: "Client email", token: "{{clientEmail}}" },
  { label: "Client phone", token: "{{clientPhone}}" },
  { label: "Client company", token: "{{clientCompany}}" },
  { label: "Business name", token: "{{vendorName}}" },
  { label: "Reference", token: "{{transactionReference}}" },
  { label: "Service amount", token: "{{paymentAmount}}" },
  { label: "Deposit amount", token: "{{depositAmount}}" },
] as const

function applyMergeFieldPreview(content: string) {
  return mergeFields.reduce(
    (acc, field) => acc.replaceAll(field.token, `[${field.label}]`),
    content
  )
}

export function ContractTemplateList({
  initialTemplates,
  initialTotalCount,
  canEdit,
  blockedMessage,
  templateLimit,
  templateLimitMessage,
}: {
  initialTemplates: ContractTemplate[]
  initialTotalCount: number
  canEdit: boolean
  blockedMessage: string
  templateLimit: number | null
  templateLimitMessage: string | null
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [templateCount, setTemplateCount] = useState(initialTotalCount)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [content, setContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const hasReachedTemplateLimit =
    templateLimit !== null && templateCount >= templateLimit

  const canCreate = canEdit && !hasReachedTemplateLimit

  const createBlockedMessage = hasReachedTemplateLimit
    ? templateLimitMessage ?? "Your current plan limit has been reached."
    : null
  const isEditingTemplate = editingId !== null

  function openNewDialog() {
    if (!canCreate) return

    setName("")
    setDescription("")
    setContent(
      "This agreement is entered into between {{vendorName}} and {{clientName}}."
    )
    setEditingId(null)
    setSaveError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(template: ContractTemplate) {
    if (!canEdit) return

    setName(template.name)
    setDescription(template.description || "")
    setContent(template.content)
    setEditingId(template.id)
    setSaveError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    if (isSaving) return
    setIsDialogOpen(false)
    setSaveError(null)
  }

  function insertMergeField(token: string) {
    setContent((current) => `${current}${current ? " " : ""}${token}`)
  }

  async function handleSave() {
    if (!canEdit) {
      setSaveError(blockedMessage)
      return
    }

    if (!editingId && hasReachedTemplateLimit) {
      setSaveError(createBlockedMessage)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const url = editingId
        ? `/api/vendor/contracts/${editingId}`
        : "/api/vendor/contracts"

      const method = editingId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content }),
      })

      const payload = await res.json().catch(() => null)

      if (res.ok) {
        const saved = payload

        if (editingId) {
          setTemplates((current) =>
            current.map((template) =>
              template.id === saved.id ? saved : template
            )
          )
        } else {
          setTemplates((current) => [saved, ...current])
          setTemplateCount((current) => current + 1)
        }

        setIsDialogOpen(false)
        setSaveError(null)
        return
      }

      setSaveError(
        payload?.message ??
        `Unable to ${editingId ? "update" : "create"} template right now`
      )
    } catch (error) {
      console.error(error)
      setSaveError(
        `Unable to ${editingId ? "update" : "create"} template right now`
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const res = await fetch(`/api/vendor/contracts/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setTemplates((current) =>
          current.filter((template) => template.id !== id)
        )
        setTemplateCount((current) => Math.max(current - 1, 0))
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTitle>Editing unavailable</AlertTitle>
          <AlertDescription>{blockedMessage}</AlertDescription>
        </Alert>
      ) : null}

      {canEdit && hasReachedTemplateLimit && createBlockedMessage ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTitle>Template limit reached</AlertTitle>
          <AlertDescription>{createBlockedMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (isSaving) return
            setIsDialogOpen(open)
            if (!open) setSaveError(null)
          }}
        >
          <Button
            onClick={openNewDialog}
            disabled={!canCreate}
            title={!canCreate ? createBlockedMessage ?? undefined : undefined}
            className="h-10 rounded-xl"
          >
            <Plus className="mr-2 size-4" />
            New Template
          </Button>

          <DialogContent className="flex h-[calc(100dvh-12px)] min-h-0 w-[calc(100vw-12px)] max-w-none flex-col gap-0 overflow-hidden rounded-[26px] p-0 sm:h-[min(720px,calc(100dvh-24px))] sm:max-w-[880px]">
            <DialogHeader className="shrink-0 border-b border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] px-4 py-3 text-left sm:px-5 sm:py-4">
              <div className="flex items-start gap-3 pr-10">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                  {isEditingTemplate ? (
                    <Edit className="size-[18px]" />
                  ) : (
                    <FileText className="size-[18px]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-[15px] font-semibold tracking-tight sm:text-lg">
                      {isEditingTemplate ? "Edit Template" : "Create Template"}
                    </DialogTitle>
                    <span className="rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Reusable contract
                    </span>
                  </div>

                  <DialogDescription className="mt-1 text-[13px] leading-5 text-muted-foreground sm:text-sm">
                    {isEditingTemplate
                      ? "Refine the wording and keep the dynamic fields ready for every new transaction."
                      : "Save a reusable contract block and insert client, payment, and transaction data where needed."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid min-h-full gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
                <div className="min-w-0 space-y-4">
                  {saveError ? (
                    <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
                      <AlertTitle>Unable to save template</AlertTitle>
                      <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-3.5 shadow-sm">
                      <Label
                        htmlFor="name"
                        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Template Name
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Standard Agreement"
                        maxLength={INPUT_LIMITS.contractTemplateName}
                        className="h-10 rounded-xl bg-muted/15 shadow-none"
                      />
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-3.5 shadow-sm">
                      <Label
                        htmlFor="description"
                        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        Description
                        <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
                          optional
                        </span>
                      </Label>
                      <Input
                        id="description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="When to use this template"
                        maxLength={INPUT_LIMITS.contractTemplateDescription}
                        className="h-10 rounded-xl bg-muted/15 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-[320px] flex-col gap-3 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.78),rgba(255,255,255,0.96))] p-4 shadow-sm sm:p-5 lg:min-h-[500px]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Label
                          htmlFor="content"
                          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          Contract Terms
                        </Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Write the reusable wording here. Merge fields are replaced automatically when the template is used.
                        </p>
                      </div>

                      <CharacterCount
                        current={content.length}
                        limit={INPUT_LIMITS.contractContent}
                        className="text-[11px] sm:text-xs"
                      />
                    </div>

                    <Textarea
                      id="content"
                      className="scrollbar-thin-subtle min-h-[240px] flex-1 resize-none rounded-2xl border-border/80 bg-background/95 leading-6 shadow-sm sm:min-h-[320px] lg:min-h-0"
                      value={content}
                      maxLength={INPUT_LIMITS.contractContent}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Write your contract terms here..."
                    />
                  </div>
                </div>

                <aside className="rounded-[24px] border border-border/70 bg-muted/20 p-4 shadow-sm lg:sticky lg:top-0">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-background text-[var(--contrazy-teal)] shadow-sm ring-1 ring-border/60">
                      <Braces className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          Merge fields
                        </p>
                        <Tags className="size-3.5 text-muted-foreground" />
                      </div>

                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Insert dynamic placeholders for client, payment, and transaction details.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {mergeFields.map((field) => (
                      <Button
                        key={field.token}
                        type="button"
                        variant="outline"
                        onClick={() => insertMergeField(field.token)}
                        className="h-10 justify-start rounded-xl px-3 text-left text-[13px] font-medium sm:text-sm"
                      >
                        <Plus className="mr-2 size-3.5" />
                        <span className="truncate">{field.label}</span>
                      </Button>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-dashed border-border/70 bg-background/75 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Quick note
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      <code className="font-mono text-[11px] text-foreground">{"{{clientName}}"}</code>{" "}
                      becomes the real client name in the final contract output.
                    </p>
                  </div>
                </aside>
              </div>
            </div>

            <DialogFooter className="flex-col shrink-0 gap-2 border-t border-border/70 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] supports-backdrop-filter:backdrop-blur sm:flex-row sm:justify-end sm:px-5">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSaving}
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <X className="mr-2 size-4" />
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                disabled={
                  isSaving || !name || !content || (!editingId && !canCreate)
                }
                className="h-10 w-full rounded-xl bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] sm:w-auto"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {isSaving ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <FileText className="size-7 text-muted-foreground" />
            </div>

            <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>

            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Create your first contract template to speed up transaction
              creation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                    <FileText className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <CardTitle className="line-clamp-1 text-base">
                      {template.name}
                    </CardTitle>

                    {template.description ? (
                      <CardDescription className="line-clamp-1">
                        {template.description}
                      </CardDescription>
                    ) : (
                      <CardDescription>No description added</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3">
                <p className="line-clamp-3 rounded-xl border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                  {applyMergeFieldPreview(template.content)}
                </p>
              </CardContent>

              <CardFooter className="flex items-center justify-between gap-3 border-t pt-3">
                <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" />
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </p>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => openEditDialog(template)}
                    disabled={!canEdit}
                  >
                    <Edit className="size-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(template.id)}
                    disabled={!canEdit}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
