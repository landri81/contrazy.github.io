"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ImageUp,
  Loader2,
  PenLine,
  RefreshCcw,
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
type ExistingSignatureState = {
  status: string
  isFinalized: boolean
  signerName?: string | null
  signerEmail?: string | null
  method?: string | null
  signatureDataUrl?: string | null
  typedValue?: string | null
  fontKey?: string | null
  signedAt?: string | null
}

type ClientSignFormProps = {
  token: string
  existingSignature?: ExistingSignatureState | null
  nextStepAfterSignature?: string
}

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

function methodFromSignatureLabel(method: string | null | undefined): SignatureMethod {
  const normalized = method?.toLowerCase() ?? ""

  if (normalized.includes("type")) return "type"
  if (normalized.includes("upload")) return "upload"

  return "draw"
}

function fontFromKey(fontKey: string | null | undefined): SigFont {
  return SIGNATURE_FONTS.find((font) => font.key === fontKey) ?? SIGNATURE_FONTS[0]
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
        const CROP_PADDING = 18
        const sampleCanvas = document.createElement("canvas")
        sampleCanvas.width = img.width
        sampleCanvas.height = img.height
        const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true })!
        sampleCtx.drawImage(img, 0, 0)

        const pixels = sampleCtx.getImageData(0, 0, img.width, img.height).data
        const sampleSize = Math.min(16, img.width, img.height)
        const cornerPoints = [
          [0, 0],
          [Math.max(0, img.width - sampleSize), 0],
          [0, Math.max(0, img.height - sampleSize)],
          [Math.max(0, img.width - sampleSize), Math.max(0, img.height - sampleSize)],
        ] as const
        let bgR = 0
        let bgG = 0
        let bgB = 0
        let bgA = 0
        let bgCount = 0

        for (const [startX, startY] of cornerPoints) {
          for (let y = startY; y < startY + sampleSize; y += 1) {
            for (let x = startX; x < startX + sampleSize; x += 1) {
              const index = (y * img.width + x) * 4
              bgR += pixels[index]
              bgG += pixels[index + 1]
              bgB += pixels[index + 2]
              bgA += pixels[index + 3]
              bgCount += 1
            }
          }
        }

        bgR /= bgCount
        bgG /= bgCount
        bgB /= bgCount
        bgA /= bgCount

        let minX = img.width
        let minY = img.height
        let maxX = -1
        let maxY = -1

        for (let y = 0; y < img.height; y += 1) {
          for (let x = 0; x < img.width; x += 1) {
            const index = (y * img.width + x) * 4
            const r = pixels[index]
            const g = pixels[index + 1]
            const b = pixels[index + 2]
            const a = pixels[index + 3]
            const backgroundDistance =
              Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) + Math.abs(a - bgA) * 0.5
            const isInk = a > 24 && backgroundDistance > 54

            if (isInk) {
              minX = Math.min(minX, x)
              minY = Math.min(minY, y)
              maxX = Math.max(maxX, x)
              maxY = Math.max(maxY, y)
            }
          }
        }

        const hasCrop = maxX >= minX && maxY >= minY
        const sx = hasCrop ? Math.max(0, minX - CROP_PADDING) : 0
        const sy = hasCrop ? Math.max(0, minY - CROP_PADDING) : 0
        const sWidth = hasCrop ? Math.min(img.width - sx, maxX - sx + CROP_PADDING + 1) : img.width
        const sHeight = hasCrop ? Math.min(img.height - sy, maxY - sy + CROP_PADDING + 1) : img.height
        const scale = Math.min((W - 32) / sWidth, (H - 24) / sHeight)
        const sw = sWidth * scale
        const sh = sHeight * scale
        const canvas = document.createElement("canvas")
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, W, H)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(img, sx, sy, sWidth, sHeight, (W - sw) / 2, (H - sh) / 2, sw, sh)
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

export function ClientSignForm({
  token,
  existingSignature,
  nextStepAfterSignature = "payment",
}: ClientSignFormProps) {
  const router = useRouter()
  useSignatureFonts()

  const initialMethod = methodFromSignatureLabel(existingSignature?.method)
  const initialSignatureDataUrl = existingSignature?.signatureDataUrl ?? null
  const hasFinalizedSignature = Boolean(
    existingSignature?.status === "SIGNED" &&
      existingSignature.isFinalized &&
      initialSignatureDataUrl
  )
  const hasUnfinalizedSignature = Boolean(
    existingSignature?.signatureDataUrl && !existingSignature.isFinalized
  )

  const [method, setMethod] = useState<SignatureMethod>(initialMethod)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-method captured data URLs
  const [drawDataUrl, setDrawDataUrl] = useState<string | null>(
    initialMethod === "draw" ? initialSignatureDataUrl : null
  )

  const [typedName, setTypedName] = useState(existingSignature?.typedValue ?? "")
  const [selectedFont, setSelectedFont] = useState<SigFont>(
    fontFromKey(existingSignature?.fontKey)
  )
  const [typeDataUrl, setTypeDataUrl] = useState<string | null>(
    initialMethod === "type" ? initialSignatureDataUrl : null
  )
  const typeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(
    initialMethod === "upload" ? initialSignatureDataUrl : null
  )
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
  const continueStep = nextStepAfterSignature === "sign" ? "payment" : nextStepAfterSignature

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

  async function submitSignature(input: {
    dataUrl: string
    method: SignatureMethod
    typedName?: string
    fontKey?: string
  }) {
    setIsPending(true)
    setError(null)

    const signedTimezone =
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined

    try {
      const body: Record<string, unknown> = {
        signatureDataUrl: input.dataUrl,
        signedTimezone,
        signatureMethod: input.method,
      }
      if (input.method === "type") {
        body.typedValue = input.typedName ?? typedName
        body.fontKey = input.fontKey ?? selectedFont.key
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!signatureDataUrl) return

    await submitSignature({
      dataUrl: signatureDataUrl,
      method,
      typedName,
      fontKey: selectedFont.key,
    })
  }

  const tabs = [
    { key: "draw"   as SignatureMethod, label: "Draw",   Icon: PenLine  },
    { key: "type"   as SignatureMethod, label: "Type",   Icon: Type     },
    { key: "upload" as SignatureMethod, label: "Upload", Icon: ImageUp  },
  ]

  if (hasFinalizedSignature) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm">
          <div className="flex items-start gap-3 border-b border-emerald-100 px-4 py-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-950">Signature already recorded</h3>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                Your signed agreement has been generated. Continue to the next step.
              </p>
            </div>
          </div>
          <div className="bg-white px-4 py-4">
            <div className="flex h-32 items-center justify-center rounded-xl border border-border/60 bg-white px-4">
              <img
                src={initialSignatureDataUrl!}
                alt="Saved signature"
                className="max-h-20 w-auto object-contain"
              />
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {existingSignature?.signerName && (
                <>
                  <dt className="font-medium text-muted-foreground">Name</dt>
                  <dd className="text-foreground">{existingSignature.signerName}</dd>
                </>
              )}
              {existingSignature?.signerEmail && (
                <>
                  <dt className="font-medium text-muted-foreground">Email</dt>
                  <dd className="text-foreground">{existingSignature.signerEmail}</dd>
                </>
              )}
              {existingSignature?.method && (
                <>
                  <dt className="font-medium text-muted-foreground">Method</dt>
                  <dd className="text-foreground">{existingSignature.method}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <Button
          type="button"
          className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.98]"
          onClick={() => router.push(`/t/${token}/${continueStep}`)}
        >
          Continue
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasUnfinalizedSignature && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
          <div className="flex gap-2.5">
            <RefreshCcw className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Saved signature found</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                Your signature image was saved, but the final signed agreement still needs to be
                generated. Tap Sign and Continue again to finish this step.
              </p>
            </div>
          </div>
          {initialSignatureDataUrl && (
            <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-amber-200 bg-white px-3">
              <img
                src={initialSignatureDataUrl}
                alt="Saved signature"
                className="max-h-16 w-auto object-contain"
              />
            </div>
          )}
        </div>
      )}

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
