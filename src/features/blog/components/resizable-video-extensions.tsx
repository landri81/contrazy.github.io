"use client"

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import YoutubeExtension from "@tiptap/extension-youtube"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/core"

import { cn } from "@/lib/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────

type HandlePos = "nw" | "ne" | "sw" | "se"
type MediaAlign = "left" | "center" | "right"

const HANDLE_CLASS: Record<HandlePos, string> = {
  nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  ne: "top-0 right-0  translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
  sw: "bottom-0 left-0 -translate-x-1/2  translate-y-1/2 cursor-sw-resize",
  se: "bottom-0 right-0  translate-x-1/2  translate-y-1/2 cursor-se-resize",
}

const YT_RATIO = 9 / 16

// ─── Resize hook ───────────────────────────────────────────────────────────────

function useResizable({
  attrWidth,
  onCommit,
}: {
  attrWidth: number | null
  onCommit: (width: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const latestWidth = useRef<number | null>(attrWidth)
  const [displayWidth, setDisplayWidth] = useState<number | null>(attrWidth)

  useEffect(() => {
    latestWidth.current = attrWidth
    setDisplayWidth(attrWidth)
  }, [attrWidth])

  function onHandleMouseDown(e: React.MouseEvent, pos: HandlePos) {
    e.preventDefault()
    e.stopPropagation()

    const container = containerRef.current
    if (!container) return

    const startX = e.clientX
    const startW = container.offsetWidth
    const isLeft = pos === "nw" || pos === "sw"

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      const rawW = isLeft ? startW - delta : startW + delta
      const maxW = containerRef.current?.parentElement?.offsetWidth ?? 900
      const clamped = Math.round(Math.max(80, Math.min(rawW, maxW)))
      latestWidth.current = clamped
      setDisplayWidth(clamped)
    }

    function onMouseUp() {
      if (latestWidth.current !== null) {
        onCommit(latestWidth.current)
      }
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return { containerRef, displayWidth, onHandleMouseDown }
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function ResizeHandles({
  onHandleMouseDown,
}: {
  onHandleMouseDown: (e: React.MouseEvent, pos: HandlePos) => void
}) {
  return (
    <>
      {(["nw", "ne", "sw", "se"] as HandlePos[]).map((pos) => (
        <div
          key={pos}
          className={cn(
            "absolute z-30 h-3 w-3 rounded-sm border-2 border-white bg-[var(--contrazy-teal)] shadow-md",
            HANDLE_CLASS[pos]
          )}
          onMouseDown={(e) => onHandleMouseDown(e, pos)}
        />
      ))}
    </>
  )
}

function MediaAlignToolbar({
  align,
  displayWidth,
  onAlignChange,
}: {
  align: MediaAlign
  displayWidth: number | null
  onAlignChange: (a: MediaAlign) => void
}) {
  return (
    <div className="blog-image-toolbar absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-xl">
      {(["left", "center", "right"] as const).map((a) => (
        <button
          key={a}
          type="button"
          title={`Align ${a}`}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={() => onAlignChange(a)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-colors",
            "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            align === a && "bg-[var(--contrazy-teal)]/15 text-[var(--contrazy-teal)]"
          )}
        >
          {a === "left" && <AlignLeft className="size-3.5" />}
          {a === "center" && <AlignCenter className="size-3.5" />}
          {a === "right" && <AlignRight className="size-3.5" />}
        </button>
      ))}
      {displayWidth !== null && (
        <>
          <div className="mx-1 h-4 w-px bg-slate-200" />
          <span className="select-none pr-0.5 font-mono text-[10px] text-slate-400">
            {displayWidth}px
          </span>
        </>
      )}
    </div>
  )
}

function alignToMargin(align: MediaAlign): React.CSSProperties {
  if (align === "left") return { marginLeft: "0", marginRight: "auto" }
  if (align === "right") return { marginLeft: "auto", marginRight: "0" }
  return { marginLeft: "auto", marginRight: "auto" }
}

// ─── Cloudinary video NodeView ─────────────────────────────────────────────────
//
// Selection strategy for <video>:
//   UNSELECTED → opaque overlay sits on top of the video (z-index 10).
//     The overlay captures the click, calls setNodeSelection(), and
//     prevents the browser from routing the click to <video> (no play).
//   SELECTED   → overlay is removed. The video is fully interactive:
//     the user can play/pause/seek normally. Resize handles and the
//     alignment toolbar appear around it. Clicking elsewhere in the
//     editor deselects.

function ResizableVideoView({ node, updateAttributes, selected, getPos, editor }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? ""
  const poster = (node.attrs.poster as string | null) ?? undefined
  const align: MediaAlign = (node.attrs.align as MediaAlign | null) ?? "center"
  const attrWidth = node.attrs.width as number | null

  const { containerRef, displayWidth, onHandleMouseDown } = useResizable({
    attrWidth,
    onCommit: (w) => updateAttributes({ width: w }),
  })

  function selectNode(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos()
    if (typeof pos === "number") {
      editor.commands.setNodeSelection(pos)
    }
  }

  return (
    <NodeViewWrapper as="div" className="blog-video-node my-5 block leading-none">
      <div
        ref={containerRef}
        className={cn(
          "relative block max-w-full",
          selected && "rounded-xl outline outline-2 outline-offset-2 outline-[var(--contrazy-teal)]"
        )}
        style={{ width: displayWidth ? `${displayWidth}px` : "100%", ...alignToMargin(align) }}
      >
        <video
          src={src}
          poster={poster}
          controls
          preload="metadata"
          draggable={false}
          className="blog-resizable-video block w-full rounded-xl"
        />

        {/*
          Unselected overlay: blocks native video click-to-play and routes
          the click to TipTap node selection instead.
          Removed once selected so the video becomes fully playable.
        */}
        {!selected && (
          <div
            className="absolute inset-0 z-10 cursor-pointer rounded-xl ring-2 ring-inset ring-transparent transition-all hover:ring-(--contrazy-teal)/40"
            onClick={selectNode}
          />
        )}

        {selected && (
          <>
            <ResizeHandles onHandleMouseDown={onHandleMouseDown} />
            <MediaAlignToolbar
              align={align}
              displayWidth={displayWidth}
              onAlignChange={(a) => updateAttributes({ align: a })}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── Cloudinary video extension ────────────────────────────────────────────────

export const ResizableBlogVideoExtension = Node.create({
  name: "blogVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      publicId: { default: null },
      poster: { default: null },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width")
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: String(attrs.width) } : {}),
      },
      align: {
        default: "center",
        parseHTML: (el) => (el.getAttribute("data-align") as MediaAlign) ?? "center",
        renderHTML: (attrs) => ({ "data-align": (attrs.align as string) ?? "center" }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "video[data-blog-video]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const { align, width, publicId, ...rest } = HTMLAttributes
    return [
      "video",
      mergeAttributes(rest, {
        "data-blog-video": true,
        controls: true,
        preload: "metadata",
        class: "blog-video w-full rounded-xl",
        style: "max-width:100%",
        "data-align": align ?? "center",
        ...(width ? { width: String(width) } : {}),
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableVideoView)
  },
})

// ─── YouTube / Vimeo embed URL helper ─────────────────────────────────────────

function toEmbedUrl(src: string): string {
  if (/youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com/.test(src)) {
    return src
  }
  const ytId = src.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`
  const vimeoId = src.match(/vimeo\.com\/(\d+)/)?.[1]
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`
  return src
}

// ─── YouTube / Vimeo NodeView ──────────────────────────────────────────────────
//
// Selection strategy for <iframe> (YouTube / Vimeo):
//   Iframes are fully opaque to the browser's event system — any click
//   inside them is swallowed and never reaches TipTap. To work around
//   this the overlay is ALWAYS present with pointer-events enabled.
//
//   Z-index hierarchy (highest wins):
//     z-40  alignment toolbar buttons  ← always on top
//     z-30  resize handle corners      ← above overlay
//     z-10  selection overlay          ← blocks iframe, routes to TipTap
//     base  iframe element
//
//   Because handles/toolbar sit above the overlay, drag-resize and
//   alignment clicks work normally. Clicking anywhere else on the node
//   (on the overlay body) calls setNodeSelection(), which either selects
//   the node (unselected state) or keeps it selected (already selected).
//   This ensures the iframe never receives raw pointer events.

function ResizableYoutubeView({ node, updateAttributes, selected, getPos, editor }: NodeViewProps) {
  const rawSrc = (node.attrs.src as string) ?? ""
  const align: MediaAlign = (node.attrs.align as MediaAlign | null) ?? "center"
  const attrWidth = (node.attrs.width as number | null) ?? 640

  const { containerRef, displayWidth, onHandleMouseDown } = useResizable({
    attrWidth,
    onCommit: (w) => updateAttributes({ width: w, height: Math.round(w * YT_RATIO) }),
  })

  const embedSrc = toEmbedUrl(rawSrc)
  const effectiveWidth = displayWidth ?? attrWidth

  function selectNode(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos()
    if (typeof pos === "number") {
      editor.commands.setNodeSelection(pos)
    }
  }

  return (
    <NodeViewWrapper as="div" className="blog-youtube-node my-5 block leading-none">
      <div
        ref={containerRef}
        className={cn(
          "relative block max-w-full",
          selected && "rounded-xl outline outline-2 outline-offset-2 outline-[var(--contrazy-teal)]"
        )}
        style={{ width: `${effectiveWidth}px`, ...alignToMargin(align) }}
      >
        <iframe
          src={embedSrc}
          width={effectiveWidth}
          height={Math.round(effectiveWidth * YT_RATIO)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          draggable={false}
          className="blog-resizable-youtube block w-full rounded-xl border-0"
          style={{ aspectRatio: "16/9", height: "auto" }}
        />

        {/*
          Permanent overlay — always blocks the iframe from receiving events.
          Handles (z-30) and toolbar (z-40) sit above this overlay so they
          remain fully interactive regardless of selection state.

          Visual behaviour:
            Unselected → cursor:pointer + subtle teal hover ring so the
              admin knows the node is clickable.
            Selected   → cursor:default, ring hidden; the teal outline on
              the container already signals selection.
        */}
        <div
          className={cn(
            "absolute inset-0 z-10 rounded-xl ring-2 ring-inset transition-all",
            selected
              ? "cursor-default ring-transparent"
              : "cursor-pointer ring-transparent hover:ring-(--contrazy-teal)/40"
          )}
          onClick={selectNode}
        />

        {selected && (
          <>
            <ResizeHandles onHandleMouseDown={onHandleMouseDown} />
            <MediaAlignToolbar
              align={align}
              displayWidth={displayWidth}
              onAlignChange={(a) => updateAttributes({ align: a })}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── YouTube / Vimeo extension ─────────────────────────────────────────────────

export const ResizableYoutubeExtension = YoutubeExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => (el.getAttribute("data-align") as MediaAlign) ?? "center",
        renderHTML: (attrs) => ({ "data-align": (attrs.align as string) ?? "center" }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableYoutubeView)
  },
})
