"use client"

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import TiptapImage from "@tiptap/extension-image"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/core"

import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type HandlePos = "nw" | "ne" | "sw" | "se"
type ImageAlign = "left" | "center" | "right"

// ─── Corner handle layout ─────────────────────────────────────────────────────

const HANDLE_CLASS: Record<HandlePos, string> = {
  nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  ne: "top-0 right-0  translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
  sw: "bottom-0 left-0 -translate-x-1/2  translate-y-1/2 cursor-sw-resize",
  se: "bottom-0 right-0  translate-x-1/2  translate-y-1/2 cursor-se-resize",
}

// ─── React NodeView ───────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? ""
  const alt = (node.attrs.alt as string | null) ?? ""
  const align: ImageAlign = (node.attrs.align as ImageAlign | null) ?? "center"
  const attrWidth = node.attrs.width as number | null

  const containerRef = useRef<HTMLDivElement>(null)
  // Use a ref for the live resize width to avoid stale-closure issues
  const latestWidth = useRef<number | null>(attrWidth)
  const [displayWidth, setDisplayWidth] = useState<number | null>(attrWidth)

  // Sync when attrs change externally (undo / redo)
  useEffect(() => {
    latestWidth.current = attrWidth
    setDisplayWidth(attrWidth)
  }, [attrWidth])

  // ── Resize logic ────────────────────────────────────────────────────────────

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
        updateAttributes({ width: latestWidth.current })
      }
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  // ── Alignment margin ────────────────────────────────────────────────────────

  const marginStyle: React.CSSProperties =
    align === "right"
      ? { marginLeft: "auto", marginRight: "0" }
      : align === "left"
        ? { marginLeft: "0", marginRight: "auto" }
        : { marginLeft: "auto", marginRight: "auto" }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <NodeViewWrapper
      as="div"
      className="blog-image-node my-5 block leading-none"
      // contentEditable=false is implicitly handled by atom:true on the extension
    >
      <div
        ref={containerRef}
        className={cn(
          "relative block max-w-full",
          selected && "rounded-xl outline outline-2 outline-offset-2 outline-[var(--contrazy-teal)]"
        )}
        style={{ width: displayWidth ? `${displayWidth}px` : "auto", ...marginStyle }}
      >
        {/* Image */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="blog-resizable-img block w-full rounded-xl"
        />

        {selected && (
          <>
            {/* 4 corner resize handles */}
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

            {/* Floating toolbar: alignment + live size readout */}
            <div className="blog-image-toolbar absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-xl">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  title={`Align ${a}`}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onClick={() => updateAttributes({ align: a })}
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
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const ResizableImageExtension = TiptapImage.extend({
  // Inherit the base extension's attributes (src, alt, title) and add width + align
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width")
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {}
          return { width: String(attrs.width) }
        },
      },
      align: {
        default: "center",
        parseHTML: (el) => (el.getAttribute("data-align") as ImageAlign) ?? "center",
        renderHTML: (attrs) => ({ "data-align": (attrs.align as string) ?? "center" }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})
