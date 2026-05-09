"use client"

import type { ContractTemplate } from "@prisma/client"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Eye,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  RemoveFormatting,
  RotateCcw,
  Save,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Unlink2,
  X,
} from "lucide-react"
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"

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
  MergeFieldExtension,
  getEditorMarkup,
  insertMergeFieldInEditor,
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

// ─── Markdown paste helpers ───────────────────────────────────────────────────

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function applyInlineMarkdown(value: string) {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1<em>$2</em>")
}

function looksLikeMarkdown(value: string) {
  return /(^|\n)\s{0,3}(#{1,3}|\d+\.\s|[-*+]\s|> )|(\*\*[^*]+\*\*)|(__[^_]+__)|(\[[^\]]+\]\(https?:\/\/[^)]+\))/.test(value)
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const html: string[] = []
  let paragraphLines: string[] = []
  let unorderedItems: string[] = []
  let orderedItems: string[] = []

  function flushParagraph() {
    if (!paragraphLines.length) return
    html.push(`<p>${paragraphLines.map((l) => applyInlineMarkdown(l.trim())).join("<br>")}</p>`)
    paragraphLines = []
  }
  function flushUnordered() {
    if (!unorderedItems.length) return
    html.push(`<ul>${unorderedItems.map((i) => `<li>${applyInlineMarkdown(i)}</li>`).join("")}</ul>`)
    unorderedItems = []
  }
  function flushOrdered() {
    if (!orderedItems.length) return
    html.push(`<ol>${orderedItems.map((i) => `<li>${applyInlineMarkdown(i)}</li>`).join("")}</ol>`)
    orderedItems = []
  }
  function flushAll() { flushParagraph(); flushUnordered(); flushOrdered() }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flushAll(); continue }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      flushAll()
      const level = Math.min(headingMatch[1].length, 3)
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2].trim())}</h${level}>`)
      continue
    }
    const quoteMatch = line.match(/^>\s+(.*)$/)
    if (quoteMatch) {
      flushAll()
      html.push(`<blockquote>${applyInlineMarkdown(quoteMatch[1].trim())}</blockquote>`)
      continue
    }
    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph(); flushOrdered()
      unorderedItems.push(unorderedMatch[1].trim())
      continue
    }
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph(); flushUnordered()
      orderedItems.push(orderedMatch[1].trim())
      continue
    }
    flushUnordered(); flushOrdered()
    paragraphLines.push(rawLine)
  }
  flushAll()
  return html.length ? html.join("") : `<p>${applyInlineMarkdown(markdown.trim())}</p>`
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        "disabled:pointer-events-none disabled:opacity-35",
        active && "bg-[var(--contrazy-teal)]/12 text-[var(--contrazy-teal)]"
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />
}

function EditorToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const t = useTranslations("dashboard.vendor.contractTemplateEditor")
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)

  const headingLevel = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "0"

  function openLinkEditor() {
    const attrs = editor.getAttributes("link")
    setLinkUrl((attrs.href as string) ?? "")
    setLinkOpen(true)
    requestAnimationFrame(() => linkInputRef.current?.select())
  }

  function applyLink() {
    const trimmed = linkUrl.trim()
    if (trimmed) {
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setLinkOpen(false)
    setLinkUrl("")
  }

  function removeLink() {
    editor.chain().focus().unsetLink().run()
    setLinkOpen(false)
    setLinkUrl("")
  }

  if (linkOpen) {
    return (
      <div className="contract-editor-toolbar flex items-center gap-1.5 px-3 py-2.5">
        <Link2 className="size-4 shrink-0 text-slate-400" />
        <input
          ref={linkInputRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyLink() }
            if (e.key === "Escape") { e.preventDefault(); setLinkOpen(false) }
          }}
          placeholder={t("linkPlaceholder")}
          className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50/80 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-[var(--contrazy-teal)] focus:bg-white"
          autoFocus
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={applyLink}
          title={t("linkApply")}
          className="flex h-7 w-7 items-center justify-center rounded bg-[var(--contrazy-teal)] text-white transition-colors hover:bg-[#0eb8a0]"
        >
          <Check className="size-3.5" />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={removeLink}
            title={t("linkRemove")}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Unlink2 className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setLinkOpen(false)}
          title={t("cancel")}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn("contract-editor-toolbar flex flex-wrap items-center gap-0.5 px-3 py-2", disabled && "pointer-events-none opacity-50")}>
      {/* Heading picker */}
      <select
        value={headingLevel}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const val = e.target.value
          if (val === "0") {
            editor.chain().focus().setParagraph().run()
          } else {
            editor.chain().focus().toggleHeading({ level: parseInt(val) as 1 | 2 | 3 }).run()
          }
        }}
        className="h-7 cursor-pointer appearance-none rounded border-0 bg-transparent px-2 pr-1 text-[13px] text-slate-700 outline-none hover:bg-slate-100 focus:ring-0 min-w-[6.5rem]"
      >
        <option value="0">{t("headingNormal")}</option>
        <option value="1">{t("headingH1")}</option>
        <option value="2">{t("headingH2")}</option>
        <option value="3">{t("headingH3")}</option>
      </select>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title={t("toolBold")}>
        <Bold className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title={t("toolItalic")}>
        <Italic className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title={t("toolUnderline")}>
        <UnderlineIcon className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title={t("toolStrike")}>
        <Strikethrough className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title={t("toolOrderedList")}>
        <ListOrdered className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title={t("toolBulletList")}>
        <List className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title={t("toolAlignLeft")}>
        <AlignLeft className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title={t("toolAlignCenter")}>
        <AlignCenter className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title={t("toolAlignRight")}>
        <AlignRight className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title={t("toolAlignJustify")}>
        <AlignJustify className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title={t("toolBlockquote")}>
        <Quote className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={openLinkEditor} active={editor.isActive("link")} title={t("toolLink")}>
        <Link2 className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title={t("toolClearFormat")}>
        <RemoveFormatting className="size-3.5" />
      </ToolbarBtn>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString()
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const isApplyingRef = useRef(false)
  const editorScrollTopRef = useRef(0)

  const initialName = initialTemplate?.name ?? ""
  const initialDescription = initialTemplate?.description ?? ""
  const initialContent = initialTemplate?.content ?? defaultContractTemplateContent
  const initialUpdatedAt = initialTemplate?.updatedAt?.toISOString() ?? null
  const draftStorageKey =
    mode === "edit" && initialTemplate?.id
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | string | null>(
    initialTemplate?.updatedAt ?? null
  )
  const formattedLastSavedAt = formatTimestamp(lastSavedAt)

  // ── TipTap editor ────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "contract-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
        autolink: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Placeholder.configure({
        placeholder: t("editorPlaceholder"),
        showOnlyCurrent: false,
      }),
      MergeFieldExtension,
    ],
    content: templateMarkupToEditorHtml(initialContent),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "contract-prose-editor",
        spellcheck: "false",
      },
    },
    onUpdate({ editor: ed }) {
      if (isApplyingRef.current) return
      const markup = getEditorMarkup(ed.getHTML())
      startTransition(() => setContent(markup))
      setSaveError((cur) => (cur ? null : cur))
    },
  })

  const isEditorReady = editor !== null

  // Markdown paste handler attached to the editor DOM
  useEffect(() => {
    if (!editor) return
    const currentEditor = editor
    const el = currentEditor.view.dom

    function handlePaste(event: ClipboardEvent) {
      const text = event.clipboardData?.getData("text/plain") ?? ""
      const html = event.clipboardData?.getData("text/html") ?? ""
      if (!text || html || !looksLikeMarkdown(text)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const pastedHtml = markdownToHtml(text)
      currentEditor.chain().focus().insertContent(pastedHtml).run()
    }

    el.addEventListener("paste", handlePaste, true)
    return () => el.removeEventListener("paste", handlePaste, true)
  }, [editor])

  // Scroll preservation when toggling preview
  useLayoutEffect(() => {
    if (isPreviewMode || !editor) return
    const frame = requestAnimationFrame(() => {
      if (!editor.view.dom.closest(".contract-prose-scroll")) {
        editor.view.dom.scrollTop = editorScrollTopRef.current
      }
      editor.commands.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [isPreviewMode, editor])

  // ── Draft loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      const localDraft = loadContractDraft(draftStorageKey)
      if (!localDraft) { setIsDraftReady(true); return }

      const matchesInitial =
        localDraft.name === initialName &&
        localDraft.description === initialDescription &&
        localDraft.content === initialContent

      if (matchesInitial) {
        clearContractDraft(draftStorageKey)
        setIsDraftReady(true)
        return
      }
      setRestoreState({ status: "available", draft: localDraft })
      setIsDraftReady(true)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [draftStorageKey, initialContent, initialDescription, initialName])

  // ── Auto-save draft ───────────────────────────────────────────────────────────
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

  const deferredContent = useDeferredValue(content)
  const plainTextContent = useMemo(() => stripContractMarkup(content), [content])
  const previewHtml = useMemo(
    () =>
      isPreviewMode
        ? renderContractTemplateSample(
            deferredContent.trim() ? deferredContent : defaultContractTemplateContent
          )
        : "",
    [deferredContent, isPreviewMode]
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
    if (!isDraftReady || restoreState.status === "available" || !canEdit) return
    if (!isDirty) { clearContractDraft(draftStorageKey); return }

    const timeout = setTimeout(() => {
      saveContractDraft(
        draftStorageKey,
        createDraftSnapshot({
          name, description, content,
          selectionIndex: null,
          sourceUpdatedAt: initialUpdatedAt,
        })
      )
    }, 450)
    return () => clearTimeout(timeout)
  }, [canEdit, content, description, draftStorageKey, initialUpdatedAt, isDirty, isDraftReady, name, restoreState.status])

  useEffect(() => {
    if (!isDraftReady || restoreState.status === "available" || !isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault(); e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty, isDraftReady, restoreState.status])

  // ── Sidebar labels ────────────────────────────────────────────────────────────
  const sidebarGroupLabels: Record<string, string> = {
    Client: t("sidebarGroups.client"),
    Vendor: t("sidebarGroups.vendor"),
    Transaction: t("sidebarGroups.transaction"),
    Signature: t("sidebarGroups.signature"),
  }

  const sidebarFieldLabels: Record<string, string> = {
    "{{clientName}}": t("sidebarFields.clientName"),
    "{{clientFirstName}}": t("sidebarFields.clientFirstName"),
    "{{clientLastName}}": t("sidebarFields.clientLastName"),
    "{{clientEmail}}": t("sidebarFields.clientEmail"),
    "{{clientPhone}}": t("sidebarFields.clientPhone"),
    "{{clientCompany}}": t("sidebarFields.clientCompany"),
    "{{clientAddress}}": t("sidebarFields.clientAddress"),
    "{{clientCountry}}": t("sidebarFields.clientCountry"),
    "{{vendorName}}": t("sidebarFields.vendorName"),
    "{{transactionReference}}": t("sidebarFields.transactionReference"),
    "{{paymentAmount}}": t("sidebarFields.paymentAmount"),
    "{{depositAmount}}": t("sidebarFields.depositAmount"),
    "{{signerName}}": t("sidebarFields.signerName"),
    "{{signedDate}}": t("sidebarFields.signedDate"),
    "{{signedTime}}": t("sidebarFields.signedTime"),
    "{{signedTimestamp}}": t("sidebarFields.signedTimestamp"),
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  function applyMarkupToEditor(markup: string) {
    if (!editor) return
    isApplyingRef.current = true
    editor.commands.setContent(templateMarkupToEditorHtml(markup), {
      emitUpdate: false,
    })
    requestAnimationFrame(() => { isApplyingRef.current = false })
  }

  function handleRestoreDraft() {
    if (restoreState.status !== "available") return
    const { draft } = restoreState
    setName(draft.name)
    setDescription(draft.description)
    setContent(draft.content)
    setSaveError(null)
    setRestoreState({ status: "idle" })
    applyMarkupToEditor(draft.content)
    toast({ variant: "info", title: t("draftRestoredTitle"), description: t("draftRestoredDesc") })
  }

  function handleDiscardDraft() {
    clearContractDraft(draftStorageKey)
    setRestoreState({ status: "idle" })
  }

  function openPreview() {
    if (editor) editorScrollTopRef.current = editor.view.dom.scrollTop
    setIsPreviewMode(true)
  }

  function insertMergeField(token: string) {
    if (!editor) return
    setSaveError(null)
    insertMergeFieldInEditor(editor, token)
  }

  function preserveEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  async function handleSave() {
    if (!canEdit) { setSaveError(blockedMessage); return }
    if (hasReachedTemplateLimit && !isEditingTemplate) { setSaveError(createBlockedMessage); return }
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
      const res = await fetch(url, {
        method: isEditingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content }),
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        setSaveError(payload?.message ?? (isEditingTemplate ? t("saveErrorUpdate") : t("saveErrorCreate")))
        return
      }

      clearContractDraft(draftStorageKey)

      if (isEditingTemplate) {
        setSavedDraft({ name, description, content })
        setLastSavedAt(payload?.updatedAt ?? new Date())
        toast({ variant: "success", title: t("savedTitle"), description: t("savedDesc") })
        router.refresh()
        return
      }

      toast({ variant: "success", title: t("createdTitle"), description: t("createdDesc", { name: name.trim() || t("defaultTemplateName") }) })
      router.push(`/vendor/contracts/${payload.id}/edit`)
    } catch (error) {
      console.error(error)
      setSaveError(isEditingTemplate ? t("saveErrorUpdate") : t("saveErrorCreate"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEditingTemplate || !initialTemplate?.id || !canEdit) return
    if (!window.confirm(t("deleteConfirm"))) return

    setIsDeleting(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/vendor/contracts/${initialTemplate.id}`, { method: "DELETE" })
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header card */}
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
                  <p className="text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => isPreviewMode ? setIsPreviewMode(false) : openPreview()}
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
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  {t("deleteBtn")}
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canPersist}
                className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isSaving ? t("savingBtn") : isEditingTemplate ? t("saveBtn") : t("createBtn")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("nameLabel")}
              </Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                maxLength={INPUT_LIMITS.contractTemplateName}
                disabled={!canEdit || isSaving || isDeleting}
                className="h-10 rounded-xl bg-background shadow-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("descriptionLabel")}
              </Label>
              <Input
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

      {/* Alerts */}
      {restoreState.status === "available" ? (
        <Alert className="border-[var(--contrazy-teal)]/20 bg-[var(--contrazy-teal)]/5 text-foreground">
          <AlertTitle>{t("localDraftTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("localDraftDesc")}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleDiscardDraft}>
                <X className="size-4" />{t("discard")}
              </Button>
              <Button type="button" size="sm" onClick={handleRestoreDraft}>
                <RotateCcw className="size-4" />{t("resumeDraft")}
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

      {/* Preview section */}
      <section className={cn("space-y-4", !isPreviewMode && "hidden")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{name.trim() || t("untitled")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("previewSubtitle")}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setIsPreviewMode(false)}>
            <ArrowLeft className="size-4" />{t("previewToggleBack")}
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

      {/* Editor + sidebar */}
      <div className={cn("grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px]", isPreviewMode && "hidden")}>
        <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm xl:flex xl:h-[calc(100vh-8.75rem)] xl:flex-col">
          <CardHeader className="border-b border-border/80 px-5 py-4 sm:px-6">
            <CardTitle className="text-lg">{t("contractCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 px-0 py-0 xl:flex-1">
            <div className="contract-editor-shell xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
              {/* Skeleton */}
              {!isEditorReady ? (
                <div className="space-y-3 px-5 py-5 sm:px-6">
                  <div className="h-10 animate-pulse rounded-xl bg-muted" />
                  <div className="h-[560px] animate-pulse rounded-2xl bg-muted" />
                </div>
              ) : null}

              {/* Toolbar */}
              {isEditorReady && editor ? (
                <EditorToolbar editor={editor} disabled={!canEdit || isSaving || isDeleting} />
              ) : null}

              {/* Editor content */}
              <EditorContent
                editor={editor}
                className={cn(
                  "contract-prose-scroll xl:min-h-0 xl:flex-1 xl:overflow-y-auto",
                  !isEditorReady && "hidden"
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden border-border/70 bg-white py-0 shadow-sm xl:flex xl:max-h-[calc(100vh-12.5rem)] xl:flex-col">
            <CardContent className="px-5 py-5 sm:px-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:scrollbar-thin-subtle">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("insertFieldsTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("insertFieldsDesc")}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={openPreview} disabled={!isEditorReady}>
                    <Eye className="size-4" />{t("previewToggle")}
                  </Button>
                </div>

                {vendorContractMergeFieldGroups.map((group) => (
                  <section key={group.label} className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {sidebarGroupLabels[group.label] ?? group.label}
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
                              {sidebarFieldLabels[field.token] ?? field.label}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">{field.token}</span>
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
