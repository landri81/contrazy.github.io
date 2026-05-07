"use client"

import type { ContractTemplate } from "@prisma/client"
import {
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import type Quill from "quill"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import { ContractDocumentViewer } from "@/features/contracts/components/contract-document-viewer"
import { stripContractMarkup } from "@/features/contracts/contract-content"
import {
  clearContractDraft,
  createDraftSnapshot,
  loadContractDraft,
  saveContractDraft,
  type ContractEditorRestoreState,
} from "@/features/contracts/editor/local-drafts"
import {
  attachContractMergeFieldMatcher,
  ensureContractMergeFieldBlot,
  getEditorMarkup,
  insertMergeFieldChip,
  templateMarkupToEditorHtml,
} from "@/features/contracts/editor/merge-field-chips"
import {
  defaultContractTemplateContent,
  renderContractTemplateSample,
  vendorContractMergeFieldGroups,
} from "@/features/contracts/template-authoring"

type EditorTemplate = Pick<
  ContractTemplate,
  "id" | "name" | "description" | "content" | "updatedAt"
>

type QuillSelection = {
  index: number
  length: number
}

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ align: [] }],
  ["blockquote", "link"],
  ["clean"],
]

const allowedFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "align",
  "blockquote",
  "link",
  "contractMergeField",
]

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleDateString()
}

export function ContractTemplateEditor({
  mode,
  initialTemplate,
  canEdit,
  blockedMessage,
  templateLimit,
  templateCount,
  templateLimitMessage,
}: {
  mode: "create" | "edit"
  initialTemplate?: EditorTemplate | null
  canEdit: boolean
  blockedMessage: string
  templateLimit?: number | null
  templateCount?: number
  templateLimitMessage?: string | null
}) {
  const t = useTranslations("dashboard.vendor.contractTemplateEditor")
  const router = useRouter()
  const editorHostRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<Quill | null>(null)
  const selectionRef = useRef<QuillSelection | null>(null)
  const lastSelectionIndexRef = useRef<number | null>(null)
  const isApplyingEditorStateRef = useRef(false)
  const editorScrollTopRef = useRef(0)
  const contentRef = useRef("")

  const initialName = initialTemplate?.name ?? ""
  const initialDescription = initialTemplate?.description ?? ""
  const initialContent = initialTemplate?.content ?? defaultContractTemplateContent
  const initialUpdatedAt = initialTemplate?.updatedAt?.toISOString() ?? null
  const draftStorageKey = mode === "edit" && initialTemplate?.id
    ? `contract-template:${initialTemplate.id}`
    : "contract-template:create"

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [content, setContent] = useState(initialContent)
  const [savedDraft, setSavedDraft] = useState({
    name: initialName,
    description: initialDescription,
    content: initialContent,
  })
  const [restoreState, setRestoreState] = useState<ContractEditorRestoreState>({ status: "idle" })
  const [isDraftReady, setIsDraftReady] = useState(false)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | string | null>(
    initialTemplate?.updatedAt ?? null
  )
  const formattedLastSavedAt = formatTimestamp(lastSavedAt)

  const isEditingTemplate = mode === "edit" && Boolean(initialTemplate?.id)
  const hasReachedTemplateLimit =
    !isEditingTemplate &&
    templateLimit !== null &&
    templateLimit !== undefined &&
    typeof templateCount === "number" &&
    templateCount >= templateLimit

  const createBlockedMessage = hasReachedTemplateLimit
    ? templateLimitMessage ?? t("planLimitReached")
    : null

  const plainTextContent = useMemo(() => stripContractMarkup(content), [content])
  const previewHtml = useMemo(
    () => renderContractTemplateSample(content.trim() ? content : defaultContractTemplateContent),
    [content]
  )

  const canPersist =
    canEdit &&
    !isSaving &&
    !isDeleting &&
    Boolean(name.trim()) &&
    Boolean(plainTextContent.trim()) &&
    content.length <= INPUT_LIMITS.contractContent &&
    !hasReachedTemplateLimit

  const isDirty =
    name !== savedDraft.name ||
    description !== savedDraft.description ||
    content !== savedDraft.content

  useEffect(() => {
    contentRef.current = content
  }, [content])

  function applyMarkupToEditor(markup: string, selectionIndex?: number | null) {
    const quill = quillRef.current

    if (!quill) {
      return
    }

    isApplyingEditorStateRef.current = true
    const nextEditorHtml = templateMarkupToEditorHtml(markup.trim() ? markup : "")
    const nextRangeIndex = Math.max(
      0,
      Math.min(selectionIndex ?? quill.getLength() - 1, Math.max(quill.getLength() - 1, 0))
    )

    quill.setText("", "silent")
    quill.clipboard.dangerouslyPasteHTML(nextEditorHtml || "<p><br></p>", "silent")
    quill.history.clear()

    const safeIndex = Math.min(nextRangeIndex, Math.max(quill.getLength() - 1, 0))
    quill.setSelection(safeIndex, 0, "silent")
    selectionRef.current = { index: safeIndex, length: 0 }
    lastSelectionIndexRef.current = safeIndex

    window.requestAnimationFrame(() => {
      isApplyingEditorStateRef.current = false
    })
  }

  useEffect(() => {
    let cancelled = false
    const host = editorHostRef.current

    async function createEditor() {
      const { default: QuillClass } = await import("quill")

      if (!host || cancelled) {
        return
      }

      ensureContractMergeFieldBlot(QuillClass)
      host.innerHTML = ""

      const quill = new QuillClass(host, {
        theme: "snow",
        placeholder: t("editorPlaceholder"),
        modules: {
          toolbar: toolbarOptions,
        },
        formats: allowedFormats,
      })

      attachContractMergeFieldMatcher(quill, QuillClass)
      quill.clipboard.dangerouslyPasteHTML(
        templateMarkupToEditorHtml(contentRef.current.trim() ? contentRef.current : ""),
        "silent"
      )
      quill.history.clear()

      const initialRange = { index: Math.max(quill.getLength() - 1, 0), length: 0 }
      quill.setSelection(initialRange.index, 0, "silent")
      selectionRef.current = initialRange
      lastSelectionIndexRef.current = initialRange.index

      quill.on("text-change", () => {
        if (isApplyingEditorStateRef.current) {
          return
        }

        const nextMarkup = getEditorMarkup(quill)
        setContent(nextMarkup)
        setSaveError(null)
      })

      quill.on("selection-change", (range: QuillSelection | null) => {
        if (range) {
          selectionRef.current = range
          lastSelectionIndexRef.current = range.index
        }
      })

      quillRef.current = quill
      setIsEditorReady(true)
    }

    void createEditor()

    return () => {
      cancelled = true
      quillRef.current = null
      selectionRef.current = null
      setIsEditorReady(false)
      if (host) {
        host.innerHTML = ""
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const frame = window.requestAnimationFrame(() => {
      if (cancelled) {
        return
      }

      const localDraft = loadContractDraft(draftStorageKey)

      if (!localDraft) {
        setIsDraftReady(true)
        return
      }

      const matchesInitialSnapshot =
        localDraft.name === initialName &&
        localDraft.description === initialDescription &&
        localDraft.content === initialContent

      if (matchesInitialSnapshot) {
        clearContractDraft(draftStorageKey)
        setIsDraftReady(true)
        return
      }

      setRestoreState({ status: "available", draft: localDraft })
      setIsDraftReady(true)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [draftStorageKey, initialContent, initialDescription, initialName])

  useEffect(() => {
    if (isPreviewMode || !quillRef.current) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const quill = quillRef.current

      if (!quill) {
        return
      }

      quill.focus()

      if (selectionRef.current) {
        quill.setSelection(selectionRef.current.index, selectionRef.current.length, "silent")
      }

      quill.root.scrollTop = editorScrollTopRef.current
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isPreviewMode])

  useEffect(() => {
    if (!isDraftReady || restoreState.status === "available" || !canEdit) {
      return
    }

    if (!isDirty) {
      clearContractDraft(draftStorageKey)
      return
    }

    const timeout = window.setTimeout(() => {
      saveContractDraft(
        draftStorageKey,
        createDraftSnapshot({
          name,
          description,
          content,
          selectionIndex: lastSelectionIndexRef.current,
          sourceUpdatedAt: initialUpdatedAt,
        })
      )
    }, 450)

    return () => window.clearTimeout(timeout)
  }, [
    canEdit,
    content,
    description,
    draftStorageKey,
    initialUpdatedAt,
    isDirty,
    isDraftReady,
    name,
    restoreState.status,
  ])

  useEffect(() => {
    if (!isDraftReady || restoreState.status === "available" || !isDirty) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty, isDraftReady, restoreState.status])

  function preserveEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function handleRestoreDraft() {
    if (restoreState.status !== "available") {
      return
    }

    const { draft } = restoreState
    setName(draft.name)
    setDescription(draft.description)
    setContent(draft.content)
    setSaveError(null)
    setRestoreState({ status: "idle" })
    lastSelectionIndexRef.current = draft.selectionIndex
    toast({
      variant: "info",
      title: t("draftRestoredTitle"),
      description: t("draftRestoredDesc"),
    })

    if (quillRef.current) {
      applyMarkupToEditor(draft.content, draft.selectionIndex)
    }
  }

  function handleDiscardDraft() {
    clearContractDraft(draftStorageKey)
    setRestoreState({ status: "idle" })
  }

  function openPreview() {
    if (quillRef.current) {
      editorScrollTopRef.current = quillRef.current.root.scrollTop
    }

    setIsPreviewMode(true)
  }

  function insertMergeField(token: string) {
    const quill = quillRef.current

    if (!quill) {
      return
    }

    setSaveError(null)

    const liveRange = quill.getSelection(true)
    const fallbackIndex = Math.max(quill.getLength() - 1, 0)
    const range = liveRange ?? selectionRef.current ?? { index: fallbackIndex, length: 0 }

    quill.focus()
    insertMergeFieldChip(quill, token, range)

    const nextIndex = range.index + 1
    selectionRef.current = { index: nextIndex, length: 0 }
    lastSelectionIndexRef.current = nextIndex
  }

  async function handleSave() {
    if (!canEdit) {
      setSaveError(blockedMessage)
      return
    }

    if (hasReachedTemplateLimit && !isEditingTemplate) {
      setSaveError(createBlockedMessage)
      return
    }

    if (content.length > INPUT_LIMITS.contractContent) {
      setSaveError(t("contentTooLong", { limit: INPUT_LIMITS.contractContent }))
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const url = isEditingTemplate
        ? `/api/vendor/contracts/${initialTemplate?.id}`
        : "/api/vendor/contracts"
      const method = isEditingTemplate ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        setSaveError(
          payload?.message ??
            (isEditingTemplate ? t("saveErrorUpdate") : t("saveErrorCreate"))
        )
        return
      }

      clearContractDraft(draftStorageKey)

      if (isEditingTemplate) {
        setSavedDraft({ name, description, content })
        setLastSavedAt(payload?.updatedAt ?? new Date())
        toast({
          variant: "success",
          title: t("savedTitle"),
          description: t("savedDesc"),
        })
        router.refresh()
        return
      }

      toast({
        variant: "success",
        title: t("createdTitle"),
        description: t("createdDesc", { name: name.trim() || t("defaultTemplateName") }),
      })
      router.push(`/vendor/contracts/${payload.id}/edit`)
    } catch (error) {
      console.error(error)
      setSaveError(isEditingTemplate ? t("saveErrorUpdate") : t("saveErrorCreate"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEditingTemplate || !initialTemplate?.id || !canEdit) {
      return
    }

    if (!window.confirm(t("deleteConfirm"))) {
      return
    }

    setIsDeleting(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/vendor/contracts/${initialTemplate.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setSaveError(payload?.message ?? t("deleteError"))
        return
      }

      clearContractDraft(draftStorageKey)
      router.push("/vendor/contracts")
      router.refresh()
    } catch (error) {
      console.error(error)
      setSaveError(t("deleteError"))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm">
        <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <DashboardRouteLink
                href="/vendor/contracts"
                pendingLabel={t("backToTemplates")}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}
              >
                <ArrowLeft className="size-4" />
                {t("back")}
              </DashboardRouteLink>

              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                  <FileText className="size-5" />
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {isEditingTemplate ? t("editTitle") : t("createTitle")}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("subtitle")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isPreviewMode) {
                    setIsPreviewMode(false)
                  } else {
                    openPreview()
                  }
                }}
                disabled={!isEditorReady && !isPreviewMode}
              >
                <Eye className="size-4" />
                {isPreviewMode ? t("previewToggleBack") : t("previewToggle")}
              </Button>

              {isEditingTemplate ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!canEdit || isSaving || isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t("deleteBtn")}
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canPersist}
                className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {isSaving ? t("savingBtn") : isEditingTemplate ? t("saveBtn") : t("createBtn")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label
                htmlFor="template-name"
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {t("nameLabel")}
              </Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                }}
                placeholder={t("namePlaceholder")}
                maxLength={INPUT_LIMITS.contractTemplateName}
                disabled={!canEdit || isSaving || isDeleting}
                className="h-10 rounded-xl bg-background shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="template-description"
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {t("descriptionLabel")}
              </Label>
              <Input
                id="template-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                }}
                placeholder={t("descriptionPlaceholder")}
                maxLength={INPUT_LIMITS.contractTemplateDescription}
                disabled={!canEdit || isSaving || isDeleting}
                className="h-10 rounded-xl bg-background shadow-none"
              />
            </div>

            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                {formattedLastSavedAt ? t("updatedAt", { date: formattedLastSavedAt }) : t("unsavedDraft")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {restoreState.status === "available" ? (
        <Alert className="border-[var(--contrazy-teal)]/20 bg-[var(--contrazy-teal)]/5 text-foreground">
          <AlertTitle>{t("localDraftTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("localDraftDesc")}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleDiscardDraft}>
                <X className="size-4" />
                {t("discard")}
              </Button>
              <Button type="button" size="sm" onClick={handleRestoreDraft}>
                <RotateCcw className="size-4" />
                {t("resumeDraft")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {!canEdit ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>{t("editingUnavailableTitle")}</AlertTitle>
          <AlertDescription>{blockedMessage}</AlertDescription>
        </Alert>
      ) : null}

      {createBlockedMessage ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>{t("templateLimitTitle")}</AlertTitle>
          <AlertDescription>{createBlockedMessage}</AlertDescription>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert className="border-destructive/25 bg-destructive/5 text-destructive">
          <AlertTitle>{t("saveFailedTitle")}</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      <section className={cn("space-y-4", !isPreviewMode && "hidden")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {name.trim() || t("untitled")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("previewSubtitle")}
            </p>
          </div>

          <Button type="button" variant="outline" onClick={() => setIsPreviewMode(false)}>
            <ArrowLeft className="size-4" />
            {t("previewToggleBack")}
          </Button>
        </div>

        <div className="rounded-[30px] border border-border/70 bg-(--contrazy-bg-muted)/85 p-3 shadow-sm sm:p-5">
          <ContractDocumentViewer
            html={previewHtml}
            layout="paged"
            sampleMode
            className="mx-auto max-w-275"
            documentMeta={{
              vendorName: "Polarsoft BD",
              clientName: "Alex Morgan",
              reference: "TX-2048-A",
              amount: 320000,
              depositAmount: 80000,
              currency: "EUR",
            }}
          />
        </div>
      </section>

      <div
        className={cn(
          "grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px]",
          isPreviewMode && "hidden"
        )}
      >
        <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm xl:flex xl:h-[calc(100vh-8.75rem)] xl:flex-col">
          <CardHeader className="border-b border-border/80 px-5 py-4 sm:px-6">
            <CardTitle className="text-lg">{t("contractCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 px-0 py-0 xl:flex-1">
            <div className="contract-editor-shell xl:h-full xl:overflow-hidden">
              {!isEditorReady ? (
                <div className="space-y-3 px-5 py-5 sm:px-6">
                  <div className="h-12 animate-pulse rounded-2xl bg-muted" />
                  <div className="h-[560px] animate-pulse rounded-[24px] bg-muted" />
                </div>
              ) : null}

              <div
                ref={editorHostRef}
                className={cn(
                  "min-h-[620px] xl:h-full",
                  !isEditorReady && "hidden"
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm xl:flex xl:max-h-[calc(100vh-12.5rem)] xl:flex-col">
            <CardContent className="px-5 py-5 sm:px-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:scrollbar-thin-subtle">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("insertFieldsTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("insertFieldsDesc")}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openPreview}
                    disabled={!isEditorReady}
                  >
                    <Eye className="size-4" />
                    {t("previewToggle")}
                  </Button>
                </div>

                {vendorContractMergeFieldGroups.map((group) => (
                  <section key={group.label} className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </p>

                    <div className="space-y-2">
                      {group.fields.map((field) => (
                        <Button
                          key={field.token}
                          type="button"
                          variant="outline"
                          onMouseDown={preserveEditorSelection}
                          onClick={() => insertMergeField(field.token)}
                          disabled={!canEdit || isSaving || isDeleting || !isEditorReady}
                          className="h-auto w-full items-start justify-start rounded-2xl px-3 py-3 text-left"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-sm font-medium text-foreground">
                              {field.label}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {field.token}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white py-0 shadow-sm">
            <CardContent className="px-5 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                {isDirty ? t("changesLocal") : t("changesSynced")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
