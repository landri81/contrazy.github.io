"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ImageUp,
  Loader2,
  PenLine,
  ShieldCheck,
  Type,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SignaturePad } from "@/components/ui/signature-pad"
import { cn } from "@/lib/utils"

const SIGNATURE_FONTS = [
  { key: "dancing-script", label: "Dancing Script", family: "'Dancing Script', cursive", size: 58 },
  { key: "caveat",         label: "Caveat",          family: "'Caveat', cursive",          size: 60 },
  { key: "great-vibes",   label: "Great Vibes",     family: "'Great Vibes', cursive",     size: 56 },
  { key: "pacifico",      label: "Pacifico",        family: "'Pacifico', cursive",        size: 48 },
] as const

type SigFont = (typeof SIGNATURE_FONTS)[number]
type SignatureMethod = "draw" | "type" | "upload"

const GFONTS_URL =
  "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Caveat:wght@700&family=Great+Vibes&family=Pacifico&display=swap"

function useSignatureFonts() {
  useEffect(() => {
    if (typeof document === "undefined") return
    const id = "contrazy-sig-fonts"
    if (!document.getElementById(id)) {
      const link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      link.href = GFONTS_URL
      document.head.appendChild(link)
    }
  }, [])
}

async function renderTypedSignature(text: string, font: SigFont): Promise<string | null> {
  if (!text.trim()) return null

  try {
    await document.fonts.load(`${font.size}px ${font.family}`)
  } catch {}

  const W = 560
  const H = 156
  const PADDING = 28
  const DPR = Math.min(window.devicePixelRatio || 1, 2)

  const canvas = document.createElement("canvas")
  canvas.width = W * DPR
  canvas.height = H * DPR

  const ctx = canvas.getContext("2d")!
  ctx.scale(DPR, DPR)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)

  // Fit font size
  let fontSize = font.size
  ctx.font = `${fontSize}px ${font.family}`
  while (ctx.measureText(text).width > W - PADDING * 2 && fontSize > 18) {
    fontSize -= 2
    ctx.font = `${fontSize}px ${font.family}`
  }

  ctx.fillStyle = "#0c1e2f"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, W / 2, H / 2)

  return canvas.toDataURL("image/png")
}

function normalizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const W = 560
        const H = 156
        const scale = Math.min(W / img.width, H / img.height, 1)
        const sw = img.width * scale
        const sh = img.height * scale
        const canvas = document.createElement("canvas")
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh)
        resolve(canvas.toDataURL("image/png"))
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DrawMethod({ onChange }: { onChange: (url: string | null) => void }) {
  return <SignaturePad onChange={onChange} />
}

function TypeMethod({
  typedName,
  setTypedName,
  selectedFont,
  setSelectedFont,
  previewDataUrl,
}: {
  typedName: string
  setTypedName: (v: string) => void
  selectedFont: SigFont
  setSelectedFont: (f: SigFont) => void
  previewDataUrl: string | null
}) {
  const previewText = typedName || "Your Signature"

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Type your full legal name
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="e.g. Jane Smith"
          maxLength={100}
          className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-(--contrazy-teal) focus:ring-1 focus:ring-(--contrazy-teal)/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Choose a signature style
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SIGNATURE_FONTS.map((font) => (
            <button
              key={font.key}
              type="button"
              onClick={() => setSelectedFont(font)}
              className={cn(
                "overflow-hidden rounded-xl border py-2.5 text-center transition-all",
                selectedFont.key === font.key
                  ? "border-(--contrazy-teal) bg-(--contrazy-teal)/5 ring-1 ring-(--contrazy-teal)/20"
                  : "border-border/60 bg-white hover:border-border"
              )}
              style={{ fontFamily: font.family, fontSize: "22px", color: "#0c1e2f", lineHeight: "1.4" }}
            >
              {previewText}
            </button>
          ))}
        </div>
      </div>

      {previewDataUrl ? (
        <div className="overflow-hidden rounded-xl border-2 border-(--contrazy-navy)/15 bg-white">
          <img
            src={previewDataUrl}
            alt="Signature preview"
            className="mx-auto block h-19.5 w-auto"
          />
        </div>
      ) : (
        <div className="flex h-19.5 items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-muted/10">
          <p className="text-sm text-muted-foreground/60">
            {typedName.trim() ? "Generating preview…" : "Type your name above to preview"}
          </p>
        </div>
      )}
    </div>
  )
}

function UploadMethod({
  onFileChange,
  uploadDataUrl,
  uploadError,
  onClear,
}: {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  uploadDataUrl: string | null
  uploadError: string | null
  onClear: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3">
      {uploadError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {uploadError}
        </div>
      )}

      {uploadDataUrl ? (
        <div className="overflow-hidden rounded-xl border-2 border-(--contrazy-navy)/15 bg-white">
          <img
            src={uploadDataUrl}
            alt="Uploaded signature"
            className="mx-auto block h-19.5 w-auto"
          />
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-3 py-1.5">
            <p className="text-xs text-muted-foreground">Signature uploaded</p>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="size-3" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/10 transition-colors hover:border-border hover:bg-muted/20"
        >
          <ImageUp className="size-8 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Click to upload your signature
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">PNG, JPG or WebP — max 5 MB</p>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  )
}

// ─── Main form ───────────────────────────────────────────────────────────────

export function ClientSignForm({ token }: { token: string }) {
  const router = useRouter()
  useSignatureFonts()

  const [method, setMethod] = useState<SignatureMethod>("draw")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-method captured data URLs
  const [drawDataUrl, setDrawDataUrl] = useState<string | null>(null)

  const [typedName, setTypedName] = useState("")
  const [selectedFont, setSelectedFont] = useState<SigFont>(SIGNATURE_FONTS[0])
  const [typeDataUrl, setTypeDataUrl] = useState<string | null>(null)
  const typeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Regenerate typed preview with debounce
  useEffect(() => {
    if (typeDebounce.current) clearTimeout(typeDebounce.current)
    if (!typedName.trim()) {
      setTypeDataUrl(null)
      return
    }
    typeDebounce.current = setTimeout(async () => {
      const url = await renderTypedSignature(typedName, selectedFont)
      setTypeDataUrl(url)
    }, 220)
    return () => {
      if (typeDebounce.current) clearTimeout(typeDebounce.current)
    }
  }, [typedName, selectedFont])

  const signatureDataUrl =
    method === "draw"   ? drawDataUrl :
    method === "type"   ? typeDataUrl :
    uploadDataUrl

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (PNG, JPG, or WebP).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.")
      return
    }
    try {
      const url = await normalizeImageToDataUrl(file)
      setUploadDataUrl(url)
    } catch {
      setUploadError("Could not process that image. Please try another file.")
    }
    // Reset input so the same file can be re-selected after clearing
    e.target.value = ""
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!signatureDataUrl) return
    setIsPending(true)
    setError(null)

    const signedTimezone =
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined

    try {
      const body: Record<string, unknown> = {
        signatureDataUrl,
        signedTimezone,
        signatureMethod: method,
      }
      if (method === "type") {
        body.typedValue = typedName
        body.fontKey = selectedFont.key
      }

      const response = await fetch(`/api/client/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const payload = await response.json()
        router.push(`/t/${token}/${payload.nextStep ?? "payment"}`)
        return
      }

      if (response.status === 410) {
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await response.json().catch(() => null)
      setError(payload?.message ?? "Unable to record your signature right now.")
    } catch (err) {
      console.error(err)
      setError("Unable to record your signature right now.")
    } finally {
      setIsPending(false)
    }
  }

  const tabs = [
    { key: "draw"   as SignatureMethod, label: "Draw",   Icon: PenLine  },
    { key: "type"   as SignatureMethod, label: "Type",   Icon: Type     },
    { key: "upload" as SignatureMethod, label: "Upload", Icon: ImageUp  },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
        {/* Method tabs */}
        <div className="flex border-b border-border/50">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium transition-colors",
                method === key
                  ? "border-b-2 border-(--contrazy-teal) text-(--contrazy-teal)"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Method content */}
        <div className="p-3 sm:p-4">
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {method === "draw" && <DrawMethod onChange={setDrawDataUrl} />}
          {method === "type" && (
            <TypeMethod
              typedName={typedName}
              setTypedName={setTypedName}
              selectedFont={selectedFont}
              setSelectedFont={setSelectedFont}
              previewDataUrl={typeDataUrl}
            />
          )}
          {method === "upload" && (
            <UploadMethod
              onFileChange={handleFileChange}
              uploadDataUrl={uploadDataUrl}
              uploadError={uploadError}
              onClear={() => setUploadDataUrl(null)}
            />
          )}

          <div className="mt-2.5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground/60">
              {signatureDataUrl
                ? "Signature ready — tap Sign to continue"
                : "Signature required to continue"}
            </p>
            {signatureDataUrl && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Ready
              </motion.span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          By tapping{" "}
          <strong className="font-medium text-foreground">Sign and Continue</strong>, you confirm
          your intent to sign electronically. Your signature, name, email, timestamp, and IP
          address will be recorded.
        </p>
      </div>

      <Button
        type="submit"
        className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.98]"
        disabled={isPending || !signatureDataUrl}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Recording signature…
          </>
        ) : (
          <>
            <PenLine className="mr-2 size-5" />
            Sign and Continue
          </>
        )}
      </Button>
    </form>
  )
}
