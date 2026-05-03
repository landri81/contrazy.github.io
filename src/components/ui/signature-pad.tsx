"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  className?: string
}

function applyStyle(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#0f172a"
  ctx.fillStyle = "#0f172a"
  ctx.lineWidth = 2.4
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
}

export function SignaturePad({ onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    applyStyle(ctx)
  }, [])

  useEffect(() => {
    initCanvas()

    const observer = new ResizeObserver(() => {
      // Only re-init if empty — resizing clears the canvas
      if (empty) initCanvas()
    })
    if (wrapRef.current) observer.observe(wrapRef.current)
    return () => observer.disconnect()
  }, [initCanvas, empty])

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = getPoint(e)
    lastPt.current = p
    const ctx = getCtx()
    if (!ctx) return
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = getCtx()
    const last = lastPt.current
    if (!ctx || !last) return
    const p = getPoint(e)
    const mx = (last.x + p.x) / 2
    const my = (last.y + p.y) / 2
    ctx.quadraticCurveTo(last.x, last.y, mx, my)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mx, my)
    lastPt.current = p
    if (empty) setEmpty(false)
  }

  function onPointerUp() {
    if (!drawing.current) return
    drawing.current = false
    lastPt.current = null
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL("image/png"))
  }

  function clearPad() {
    const canvas = canvasRef.current
    if (!canvas) return
    const savedWidth = canvas.width
    canvas.width = savedWidth
    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    applyStyle(ctx)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative h-44 select-none sm:h-52",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "block h-full w-full touch-none cursor-crosshair rounded-xl border-2 transition-colors duration-200",
          empty
            ? "border-dashed border-border/60 bg-muted/10"
            : "border-(--contrazy-navy)/25 bg-white dark:bg-zinc-950"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Baseline */}
      <div
        className="pointer-events-none absolute left-8 right-8 border-b border-dashed border-border/40"
        style={{ top: "72%" }}
      />

      {/* Placeholder */}
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="size-10 text-muted-foreground/20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/50">Sign here</p>
            <p className="text-xs text-muted-foreground/35">Mouse, stylus or finger</p>
          </div>
        </div>
      )}

      {/* Clear button */}
      {!empty && (
        <button
          type="button"
          onClick={clearPad}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          <Trash2 className="size-3" />
          Clear
        </button>
      )}
    </div>
  )
}
