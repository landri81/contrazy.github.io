"use client"

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Clapperboard,
  Eye,
  EyeOff,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  RemoveFormatting,
  Strikethrough,
  UnderlineIcon,
  Unlink2,
  Upload,
  Video,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { ResizableImageExtension } from "./resizable-image-extension"
import { ResizableBlogVideoExtension, ResizableYoutubeExtension } from "./resizable-video-extensions"
import type { LocaleCode } from "@prisma/client"

const MAX_COVER_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

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
  title?: string
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
        "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        "disabled:pointer-events-none disabled:opacity-40",
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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

type ToolbarMode = "default" | "link" | "videoEmbed"

function BlogEditorToolbar({
  editor,
  disabled,
  isUploadingImage,
  isUploadingVideo,
  onUploadImage,
  onUploadVideo,
  postId,
  t,
}: {
  editor: Editor
  disabled?: boolean
  isUploadingImage?: boolean
  isUploadingVideo?: boolean
  onUploadImage?: () => void
  onUploadVideo?: () => void
  postId?: string
  t: ReturnType<typeof useTranslations<"dashboard.admin.blog.editor">>
}) {
  const [mode, setMode] = useState<ToolbarMode>("default")
  const [linkUrl, setLinkUrl] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)
  const videoEmbedInputRef = useRef<HTMLInputElement>(null)

  const headingLevel = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "0"

  // ── Link mode ──────────────────────────────────────────────────────────────

  function openLinkEditor() {
    const attrs = editor.getAttributes("link")
    setLinkUrl((attrs.href as string) ?? "")
    setMode("link")
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
    setMode("default")
    setLinkUrl("")
  }

  function removeLink() {
    editor.chain().focus().unsetLink().run()
    setMode("default")
    setLinkUrl("")
  }

  // ── Video embed mode ───────────────────────────────────────────────────────

  function openVideoEmbed() {
    setVideoUrl("")
    setMode("videoEmbed")
    requestAnimationFrame(() => videoEmbedInputRef.current?.focus())
  }

  function applyVideoEmbed() {
    const url = videoUrl.trim()
    if (!url) { setMode("default"); return }
    // YouTube and Vimeo are handled by the Youtube extension
    editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 360 }).run()
    setMode("default")
    setVideoUrl("")
  }

  // ── Link toolbar ───────────────────────────────────────────────────────────

  if (mode === "link") {
    return (
      <div className="blog-editor-toolbar flex items-center gap-1.5 px-3 py-2.5">
        <Link2 className="size-4 shrink-0 text-slate-400" />
        <input
          ref={linkInputRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyLink() }
            if (e.key === "Escape") { e.preventDefault(); setMode("default") }
          }}
          placeholder={t("linkPlaceholder")}
          className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50/80 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-[var(--contrazy-teal)] focus:bg-white"
          autoFocus
        />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}
          className="flex h-7 w-7 items-center justify-center rounded bg-[var(--contrazy-teal)] text-white">
          <Check className="size-3.5" />
        </button>
        {editor.isActive("link") && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={removeLink}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-500">
            <Unlink2 className="size-3.5" />
          </button>
        )}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMode("default")}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100">
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  // ── Video embed toolbar ────────────────────────────────────────────────────

  if (mode === "videoEmbed") {
    return (
      <div className="blog-editor-toolbar flex items-center gap-1.5 px-3 py-2.5">
        <Clapperboard className="size-4 shrink-0 text-slate-400" />
        <input
          ref={videoEmbedInputRef}
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyVideoEmbed() }
            if (e.key === "Escape") { e.preventDefault(); setMode("default") }
          }}
          placeholder={t("videoUrlPlaceholder")}
          className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50/80 px-2.5 text-sm text-foreground outline-none transition-colors focus:border-[var(--contrazy-teal)] focus:bg-white"
          autoFocus
        />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={applyVideoEmbed}
          className="flex h-7 w-7 items-center justify-center rounded bg-[var(--contrazy-teal)] text-white" title={t("videoApply")}>
          <Check className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMode("default")}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100">
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  // ── Default toolbar ────────────────────────────────────────────────────────

  return (
    <div className={cn("blog-editor-toolbar flex flex-wrap items-center gap-0.5 px-3 py-2", disabled && "pointer-events-none opacity-50")}>
      <select
        value={headingLevel}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const val = e.target.value
          if (val === "0") editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: parseInt(val) as 1 | 2 | 3 }).run()
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

      {/* Inline image */}
      <ToolbarBtn
        onClick={() => onUploadImage?.()}
        disabled={disabled || isUploadingImage || isUploadingVideo}
        title={t("toolInlineImage")}
      >
        {isUploadingImage ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Embed video URL (YouTube / Vimeo) */}
      <ToolbarBtn
        onClick={openVideoEmbed}
        disabled={disabled || isUploadingVideo}
        title={t("toolEmbedVideo")}
      >
        <Clapperboard className="size-3.5" />
      </ToolbarBtn>

      {/* Upload video to Cloudinary */}
      <ToolbarBtn
        onClick={() => onUploadVideo?.()}
        disabled={disabled || isUploadingVideo || isUploadingImage}
        title={t("toolUploadVideo")}
      >
        {isUploadingVideo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title={t("toolClearFormat")}>
        <RemoveFormatting className="size-3.5" />
      </ToolbarBtn>
    </div>
  )
}

// ─── Main editor props ────────────────────────────────────────────────────────

type BlogPostEditorProps = {
  mode: "create" | "edit"
  postId?: string
  initialLocale?: LocaleCode
  initialTitle?: string
  initialSlug?: string
  initialExcerpt?: string
  initialContent?: object | null
  initialContentHtml?: string
  initialCategory?: string
  initialTags?: string[]
  initialSeoTitle?: string
  initialSeoDesc?: string
  initialCoverAlt?: string
  initialCoverUrl?: string | null
  initialCoverPublicId?: string | null
  initialStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  initialFeatured?: boolean
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
}

function isAcceptedVideoFile(file: File) {
  const lower = file.name.toLowerCase()
  return (
    file.type.startsWith("video/") ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".avi")
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BlogPostEditor({
  mode,
  postId,
  initialLocale = "en",
  initialTitle = "",
  initialSlug = "",
  initialExcerpt = "",
  initialContent = null,
  initialContentHtml = "",
  initialCategory = "",
  initialTags = [],
  initialSeoTitle = "",
  initialSeoDesc = "",
  initialCoverAlt = "",
  initialCoverUrl = null,
  initialCoverPublicId = null,
  initialStatus = "DRAFT",
  initialFeatured = false,
}: BlogPostEditorProps) {
  const t = useTranslations("dashboard.admin.blog.editor")
  const tBlog = useTranslations("dashboard.admin.blog")
  const router = useRouter()

  const [locale, setLocale] = useState<LocaleCode>(initialLocale)
  const [title, setTitle] = useState(initialTitle)
  const [slug, setSlug] = useState(initialSlug)
  const [slugManual, setSlugManual] = useState(Boolean(initialSlug))
  const [excerpt, setExcerpt] = useState(initialExcerpt)
  const [category, setCategory] = useState(initialCategory)
  const [tagsRaw, setTagsRaw] = useState(initialTags.join(", "))
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle)
  const [seoDesc, setSeoDesc] = useState(initialSeoDesc)
  const [coverAlt, setCoverAlt] = useState(initialCoverAlt)
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(initialStatus)
  const [featured, setFeatured] = useState(initialFeatured)
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl ?? null)
  const [coverPublicId, setCoverPublicId] = useState<string | null>(initialCoverPublicId ?? null)

  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const inlineImageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slugManual && title) setSlug(slugify(title))
  }, [title, slugManual])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, horizontalRule: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "blog-link", rel: "noopener noreferrer", target: "_blank" },
        autolink: true,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Placeholder.configure({ placeholder: t("contentPlaceholder"), showOnlyCurrent: false }),
      ResizableImageExtension.configure({ allowBase64: false, HTMLAttributes: { loading: "lazy" } }),
      ResizableYoutubeExtension.configure({
        width: 640,
        height: 360,
        allowFullscreen: true,
        nocookie: true,
      }),
      ResizableBlogVideoExtension,
    ],
    content: initialContent ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "blog-prose-editor",
        spellcheck: "true",
      },
    },
  })

  // ── Cloudinary cover upload ────────────────────────────────────────────────

  async function uploadCoverFile(file: File) {
    if (!file.type.startsWith("image/")) { toast({ variant: "error", title: t("uploadInvalidImageType") }); return }
    if (file.size > MAX_COVER_BYTES) { toast({ variant: "error", title: t("uploadImageTooLarge") }); return }

    setIsUploadingCover(true)
    try {
      const targetId = postId ?? "new"
      const signRes = await fetch(`/api/admin/blog/${targetId}/cover/sign-upload`, { method: "POST" })
      if (!signRes.ok) throw new Error("sign")
      const { apiKey, cloudName, folder, signature, timestamp } = await signRes.json()

      const fd = new FormData()
      fd.append("file", file)
      fd.append("api_key", apiKey)
      fd.append("timestamp", String(timestamp))
      fd.append("signature", signature)
      fd.append("folder", folder)

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd })
      const payload = await upRes.json().catch(() => null)
      if (!upRes.ok || !payload?.secure_url) throw new Error(payload?.error?.message ?? "upload")

      setCoverUrl(payload.secure_url as string)
      setCoverPublicId(payload.public_id as string)
    } catch {
      toast({ variant: "error", title: t("uploadCoverError") })
    } finally {
      setIsUploadingCover(false)
    }
  }

  // ── Cloudinary inline image upload ────────────────────────────────────────

  async function uploadInlineImage(file: File) {
    if (!file.type.startsWith("image/")) return
    setIsUploadingInlineImage(true)
    try {
      const targetId = postId ?? "new"
      const signRes = await fetch(`/api/admin/blog/${targetId}/cover/sign-upload`, { method: "POST" })
      if (!signRes.ok) throw new Error("sign")
      const { apiKey, cloudName, folder, signature, timestamp } = await signRes.json()

      const fd = new FormData()
      fd.append("file", file)
      fd.append("api_key", apiKey)
      fd.append("timestamp", String(timestamp))
      fd.append("signature", signature)
      fd.append("folder", folder)

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd })
      const payload = await upRes.json().catch(() => null)
      if (upRes.ok && payload?.secure_url) {
        editor?.chain().focus().setImage({ src: payload.secure_url as string }).run()
      } else {
        toast({ variant: "error", title: t("uploadFailed") })
      }
    } catch {
      toast({ variant: "error", title: t("uploadFailed") })
    } finally {
      setIsUploadingInlineImage(false)
    }
  }

  // ── Cloudinary video upload (XHR for progress) ─────────────────────────────

  async function uploadVideoFile(file: File) {
    if (!isAcceptedVideoFile(file)) { toast({ variant: "error", title: t("uploadInvalidVideoType") }); return }
    if (file.size > MAX_VIDEO_BYTES) { toast({ variant: "error", title: t("uploadVideoTooLarge") }); return }

    setIsUploadingVideo(true)
    setVideoUploadProgress(0)

    try {
      const targetId = postId ?? "new"
      const signRes = await fetch(`/api/admin/blog/${targetId}/video/sign-upload`, { method: "POST" })
      if (!signRes.ok) throw new Error("sign")
      const { apiKey, cloudName, folder, signature, timestamp } = await signRes.json()

      const fd = new FormData()
      fd.append("file", file)
      fd.append("api_key", apiKey)
      fd.append("timestamp", String(timestamp))
      fd.append("signature", signature)
      fd.append("folder", folder)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setVideoUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const payload = JSON.parse(xhr.responseText)
              if (payload?.secure_url) {
                editor?.chain().focus().insertContent({
                  type: "blogVideo",
                  attrs: {
                    src: payload.secure_url as string,
                    publicId: payload.public_id as string,
                    poster: null,
                  },
                }).run()
                resolve()
              } else {
                reject(new Error(payload?.error?.message ?? "upload"))
              }
            } catch {
              reject(new Error("parse"))
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`))
          }
        })
        xhr.addEventListener("error", () => reject(new Error("network")))
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
        xhr.send(fd)
      })
    } catch {
      toast({ variant: "error", title: t("uploadVideoError") })
    } finally {
      setIsUploadingVideo(false)
      setVideoUploadProgress(0)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(overrideStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    if (!editor) return
    setIsSaving(true)

    try {
      const tags = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      const content = editor.getJSON()
      const contentHtml = editor.getHTML()
      const finalStatus = overrideStatus ?? status

      const payload = {
        locale, title, slug, excerpt, content, contentHtml,
        category: category || undefined,
        tags,
        seoTitle: seoTitle || undefined,
        seoDesc: seoDesc || undefined,
        coverAlt: coverAlt || undefined,
        status: finalStatus, featured, coverUrl, coverPublicId,
      }

      const url = mode === "create" ? "/api/admin/blog" : `/api/admin/blog/${postId}`
      const method = mode === "create" ? "POST" : "PATCH"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        toast({ variant: "error", title: t("saveError"), description: data?.message })
        return
      }

      if (overrideStatus) setStatus(overrideStatus)
      setLastSaved(new Date())

      if (finalStatus === "PUBLISHED") {
        toast({ variant: "success", title: t("toastPublished"), description: t("toastPublishedDesc") })
      } else if (overrideStatus === "DRAFT" && status === "PUBLISHED") {
        toast({ variant: "success", title: t("toastUnpublished") })
      } else {
        toast({ variant: "success", title: t("toastDraftSaved"), description: t("toastDraftSavedDesc") })
      }

      if (mode === "create" && data.data?.id) {
        setIsNavigating(true)
        router.replace(`/admin/blog/${data.data.id}`)
      }
    } catch {
      toast({ variant: "error", title: t("saveError") })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!postId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: "DELETE" })
      if (!res.ok) {
        toast({ variant: "error", title: t("deleteError") })
        return
      }
      toast({ variant: "success", title: t("toastDeleted") })
      setIsNavigating(true)
      router.push("/admin/blog")
    } catch {
      toast({ variant: "error", title: t("deleteError") })
    } finally {
      setIsDeleting(false)
    }
  }

  const canSave = !isSaving && !isDeleting && !isUploadingVideo && Boolean(title.trim()) && Boolean(excerpt.trim()) && Boolean(slug.trim())

  return (
    <>
    {/* ── Full-page navigation loading overlay ── */}
    {isNavigating && (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm">
        <Loader2 className="size-10 animate-spin text-(--contrazy-teal)" />
        <p className="text-sm font-medium text-muted-foreground">{t("navigating")}</p>
      </div>
    )}

    <div className="flex min-h-screen flex-col gap-6 p-6 lg:flex-row lg:gap-8">
      {/* Main editor column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">

        {/* Locale + Status bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">{t("localeLabel")}</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as LocaleCode)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30"
            >
              <option value="en">{t("enLocale")}</option>
              <option value="fr">{t("frLocale")}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">{t("statusLabel")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED")}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="size-4 rounded accent-[var(--contrazy-teal)]"
            />
            <span className="text-muted-foreground">{t("featuredLabel")}</span>
          </label>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("titleLabel")}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-lg font-semibold outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("slugLabel")}</label>
          <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true) }} placeholder={t("slugPlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
        </div>

        {/* Excerpt */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("excerptLabel")}</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder={t("excerptPlaceholder")}
            className="w-full resize-y rounded-lg border border-border bg-background px-4 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
        </div>

        {/* Rich text editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("contentLabel")}</label>
            <button
              type="button"
              onClick={() => setIsPreviewMode((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                isPreviewMode
                  ? "bg-[var(--contrazy-teal)] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {isPreviewMode ? (
                <><EyeOff className="size-3.5" />{t("editMode")}</>
              ) : (
                <><Eye className="size-3.5" />{t("previewMode")}</>
              )}
            </button>
          </div>

          {/* Video upload progress bar */}
          {isUploadingVideo && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-slate-50 px-4 py-2.5">
              <Loader2 className="size-4 shrink-0 animate-spin text-[var(--contrazy-teal)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <p className="text-xs font-medium text-foreground">{t("videoUploading")}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--contrazy-teal)] transition-all duration-300"
                    style={{ width: `${videoUploadProgress}%` }}
                  />
                </div>
                <p className="text-right text-[11px] text-muted-foreground">{videoUploadProgress}%</p>
              </div>
            </div>
          )}

          <div className="blog-editor-shell overflow-hidden rounded-xl border border-border bg-background">
            {/* Editor skeleton while TipTap initialises */}
            {!editor && (
              <div className="flex min-h-128 flex-col gap-4 p-8">
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-100" />
              </div>
            )}

            {editor && !isPreviewMode && (
              <BlogEditorToolbar
                editor={editor}
                disabled={isSaving || isDeleting}
                isUploadingImage={isUploadingInlineImage}
                isUploadingVideo={isUploadingVideo}
                onUploadImage={() => inlineImageInputRef.current?.click()}
                onUploadVideo={() => videoInputRef.current?.click()}
                postId={postId}
                t={t}
              />
            )}
            {editor && (
              isPreviewMode ? (
                <div
                  className="blog-editor-preview"
                  dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
                />
              ) : (
                <EditorContent editor={editor} />
              )
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={inlineImageInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadInlineImage(f); e.target.value = "" }} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadVideoFile(f); e.target.value = "" }} />
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col gap-5 lg:w-80 lg:shrink-0">

        {/* Save actions */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleSave()}
              disabled={!canSave}
              className="w-full bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
            >
              {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              {isSaving ? t("savingBtn") : t("saveBtn")}
            </Button>

            {status !== "PUBLISHED" && (
              <Button
                onClick={() => handleSave("PUBLISHED")}
                disabled={!canSave}
                variant="outline"
                className="w-full"
              >
                {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isSaving ? t("savingBtn") : t("publishBtn")}
              </Button>
            )}
            {status === "PUBLISHED" && (
              <Button
                onClick={() => handleSave("DRAFT")}
                disabled={!canSave}
                variant="outline"
                className="w-full"
              >
                {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isSaving ? t("savingBtn") : t("unpublishBtn")}
              </Button>
            )}

            {lastSaved && (
              <p className="text-center text-[11px] text-muted-foreground">
                {t("savedAt")} {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Cover image */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("coverLabel")}</p>

          {coverUrl ? (
            <div className="space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-slate-50">
                <Image src={coverUrl} alt={coverAlt || "Cover"} fill className="object-cover" sizes="320px" />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1"
                  onClick={() => coverInputRef.current?.click()} disabled={isUploadingCover}>
                  {isUploadingCover ? <Loader2 className="size-3.5 animate-spin" /> : t("changeCover")}
                </Button>
                <Button type="button" size="sm" variant="outline"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => { setCoverUrl(null); setCoverPublicId(null) }}>
                  {t("removeCover")}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => coverInputRef.current?.click()} disabled={isUploadingCover}
              className="flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)] disabled:opacity-50">
              {isUploadingCover ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("uploadCover")}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCoverFile(f); e.target.value = "" }} />
        </div>

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metadata</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("categoryLabel")}</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("categoryPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("tagsLabel")}</label>
            <input type="text" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder={t("tagsPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("coverAlt")}</label>
            <input type="text" value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} placeholder={t("coverAltPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
          </div>
        </div>

        {/* SEO */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("seoTitle")}</label>
            <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={t("seoTitlePlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("seoDesc")}</label>
            <textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} rows={3} placeholder={t("seoDescPlaceholder")}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--contrazy-teal)]/30" />
          </div>
        </div>

        {/* Danger zone */}
        {mode === "edit" && postId && (
          <div className="rounded-xl border border-red-100 bg-background p-5 shadow-sm">
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600">{tBlog("deleteConfirm")}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="flex-1" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : t("deleteBtn")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowDeleteConfirm(true)}>
                {t("deleteBtn")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
