"use client"

import type { DocumentAsset, RequirementType, TransactionRequirement } from "@prisma/client"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCcw,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { CharacterCount } from "@/components/ui/character-count"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useSubmissionLock } from "@/features/client-flow/hooks/use-submission-lock"
import { getClientDocumentUploadFolder } from "@/features/client-flow/lib/client-document-uploads"
import {
  normalizeRequirementFileCount,
  normalizeRequirementFileSlotLabels,
} from "@/features/transactions/contract-flow"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { isPdfFile, resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"

type SavedUploadEntry = {
  source: "saved"
  documentId: string
  slotIndex: number
  slotLabel: string | null
  capturedAt: string | null
  uploadSource: "UPLOAD" | "LIVE_CAPTURE"
  secure_url: string
  public_id: string
  original_filename: string
}

type LocalUploadEntry = {
  source: "local"
  slotIndex: number
  slotLabel: string | null
  capturedAt: string | null
  uploadSource: "UPLOAD" | "LIVE_CAPTURE"
  secure_url: string
  public_id: string
  original_filename: string
}

type UploadEntry = SavedUploadEntry | LocalUploadEntry

type CleanupAssetPayload = {
  publicId: string
  assetUrl: string
  fileName: string
}

function getRequirementSlotKey(requirementId: string, slotIndex: number) {
  return `${requirementId}:${slotIndex}`
}

function getRequirementSlotLabels(requirement: Pick<TransactionRequirement, "label" | "type" | "requiredFileCount" | "fileSlotLabels">) {
  const fileCount = normalizeRequirementFileCount(requirement.type, requirement.requiredFileCount)

  return normalizeRequirementFileSlotLabels({
    type: requirement.type,
    fileCount,
    labels: requirement.fileSlotLabels,
    requirementLabel: requirement.label,
  })
}

function formatCaptureTimestamp(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

async function createStampedCaptureFile(video: HTMLVideoElement, capturedAt: Date) {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas context unavailable")
  }

  context.drawImage(video, 0, 0, width, height)

  const timestampLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(capturedAt)
  const fontSize = Math.max(24, Math.round(width * 0.028))
  const padding = Math.round(fontSize * 0.6)
  context.font = `700 ${fontSize}px Arial, sans-serif`
  const textWidth = context.measureText(timestampLabel).width
  const boxWidth = Math.round(textWidth + padding * 1.8)
  const boxHeight = Math.round(fontSize * 1.75)
  const boxX = width - boxWidth - padding
  const boxY = height - boxHeight - padding

  context.fillStyle = "rgba(0, 0, 0, 0.42)"
  context.fillRect(boxX, boxY, boxWidth, boxHeight)
  context.fillStyle = "#dc2626"
  context.textAlign = "right"
  context.textBaseline = "bottom"
  context.fillText(timestampLabel, width - padding * 1.5, height - padding * 1.15)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.92)
  })

  if (!blob) {
    throw new Error("Failed to create capture blob")
  }

  const fileName = `capture-${capturedAt.toISOString().replace(/[:.]/g, "-")}.jpg`
  return new File([blob], fileName, { type: "image/jpeg" })
}

function RequirementExamplePreview({
  assetUrl,
  fileName,
  label,
}: {
  assetUrl: string
  fileName: string | null
  label: string
}) {
  const t = useTranslations("clientFlow.uploads")
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="mb-3 overflow-hidden rounded-xl border border-sky-200/80 bg-sky-50/80">
        <div className="flex items-start gap-3 p-3">
          <div className="relative hidden size-20 overflow-hidden rounded-xl border border-sky-200/80 bg-white sm:block">
            <Image
              src={assetUrl}
              alt={fileName || label}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 ring-1 ring-sky-200/80">
                {t("exampleLabel")}
              </span>
              <span className="text-xs text-sky-700/80">{t("exampleHint")}</span>
            </div>
            <p className="text-sm font-medium text-sky-950">{label}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-sky-200 bg-white px-3 text-xs text-sky-900 hover:bg-sky-100"
              onClick={() => setOpen(true)}
            >
              <Eye className="size-3.5" />
              {t("viewExample")}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[680px] overflow-hidden rounded-2xl p-0">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-base font-semibold">
                {t("examplePreviewTitle", { label })}
              </DialogTitle>
              <DialogDescription>{t("examplePreviewDescription")}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/70 bg-muted/20 p-4">
              <Image
                src={assetUrl}
                alt={fileName || label}
                width={1200}
                height={900}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function buildInitialDocumentState(
  requirements: TransactionRequirement[],
  existingDocuments: DocumentAsset[]
) {
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const savedUploads: Record<string, SavedUploadEntry> = {}
  const uploads: Record<string, UploadEntry> = {}
  const textInputs: Record<string, string> = {}

  for (const document of existingDocuments) {
    if (!document.requirementId) {
      continue
    }

    const requirement = requirementsById.get(document.requirementId)
    const resolvedType = (requirement?.type ?? document.type) as RequirementType

    if (resolvedType === "TEXT") {
      if (document.textValue?.trim()) {
        textInputs[document.requirementId] = document.textValue
      }

      continue
    }

    if (!document.assetUrl || !document.publicId) {
      continue
    }

    const slotIndex = document.slotIndex ?? 0
    const slotKey = getRequirementSlotKey(document.requirementId, slotIndex)

    const savedUpload: SavedUploadEntry = {
      source: "saved",
      documentId: document.id,
      slotIndex,
      slotLabel: document.slotLabel ?? null,
      capturedAt: document.capturedAt ? document.capturedAt.toISOString() : null,
      uploadSource: document.source ?? "UPLOAD",
      secure_url: document.assetUrl,
      public_id: document.publicId,
      original_filename: document.fileName || document.label,
    }

    savedUploads[slotKey] = savedUpload
    uploads[slotKey] = savedUpload
  }

  return { savedUploads, uploads, textInputs }
}

function toCleanupAsset(upload: UploadEntry): CleanupAssetPayload {
  return {
    publicId: upload.public_id,
    assetUrl: upload.secure_url,
    fileName: upload.original_filename,
  }
}

export function ClientUploadsForm({
  token,
  requirements,
  existingDocuments,
  skipStep,
}: {
  token: string
  requirements: TransactionRequirement[]
  existingDocuments: DocumentAsset[]
  skipStep: string
}) {
  const t = useTranslations("clientFlow.uploads")
  const router = useRouter()
  const submission = useSubmissionLock()

  const initialState = useMemo(
    () => buildInitialDocumentState(requirements, existingDocuments),
    [existingDocuments, requirements]
  )

  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Record<string, UploadEntry>>(() => initialState.uploads)
  const [savedUploads, setSavedUploads] = useState<Record<string, SavedUploadEntry>>(
    () => initialState.savedUploads
  )
  const [textInputs, setTextInputs] = useState<Record<string, string>>(() => initialState.textInputs)
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({})
  const [deletingState, setDeletingState] = useState<Record<string, boolean>>({})
  const [activeCaptureSlotKey, setActiveCaptureSlotKey] = useState<string | null>(null)
  const [cameraErrorBySlot, setCameraErrorBySlot] = useState<Record<string, string | null>>({})
  const [startingCameraKey, setStartingCameraKey] = useState<string | null>(null)
  const pendingLocalAssetsRef = useRef<CleanupAssetPayload[]>([])
  const skipPendingCleanupRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const reqCategoryLabels: Record<string, string> = {
    ID: t("reqCategoryId"),
    PROOF_OF_ADDRESS: t("reqCategoryProofOfAddress"),
    DRIVER_LICENSE: t("reqCategoryDriverLicense"),
    COMPANY_REGISTRATION: t("reqCategoryCompanyRegistration"),
    CONTRACT_ATTACHMENT: t("reqCategoryContractAttachment"),
    CUSTOM: t("reqCategoryCustom"),
    OTHER: t("reqCategoryOther"),
  }

  function translatedCategoryLabel(category: string, customLabel?: string | null) {
    if (category === "OTHER" && customLabel?.trim()) return customLabel.trim()
    return reqCategoryLabels[category] ?? t("reqCategoryCustom")
  }

  function translatedTextPlaceholder(category: string) {
    switch (category) {
      case "PROOF_OF_ADDRESS":
        return t("reqTextPlaceholderProofOfAddress")
      case "COMPANY_REGISTRATION":
        return t("reqTextPlaceholderCompanyRegistration")
      case "CONTRACT_ATTACHMENT":
        return t("reqTextPlaceholderContractAttachment")
      case "OTHER":
        return t("reqTextPlaceholderOther")
      default:
        return t("reqTextPlaceholderDefault")
    }
  }

  function getSlotLabels(requirement: TransactionRequirement) {
    return getRequirementSlotLabels(requirement)
  }

  function getSlotKey(requirementId: string, slotIndex: number) {
    return getRequirementSlotKey(requirementId, slotIndex)
  }

  function stopCaptureStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function startCaptureForSlot(slotKey: string) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraErrorBySlot((current) => ({ ...current, [slotKey]: t("cameraUnsupported") }))
      return
    }

    stopCaptureStream()
    setError(null)
    setStartingCameraKey(slotKey)
    setCameraErrorBySlot((current) => ({ ...current, [slotKey]: null }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      })

      streamRef.current = stream
      setActiveCaptureSlotKey(slotKey)
    } catch (captureError) {
      console.error(captureError)
      setCameraErrorBySlot((current) => ({ ...current, [slotKey]: t("cameraRequired") }))
      stopCaptureStream()
      setActiveCaptureSlotKey(null)
    } finally {
      setStartingCameraKey(null)
    }
  }

  function cancelCaptureForSlot(slotKey: string) {
    if (activeCaptureSlotKey === slotKey) {
      stopCaptureStream()
      setActiveCaptureSlotKey(null)
    }
  }

  async function cleanupTemporaryAssets(
    assets: CleanupAssetPayload[],
    options?: { keepalive?: boolean }
  ) {
    if (assets.length === 0) {
      return
    }

    try {
      await fetch(`/api/client/${token}/documents/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets }),
        keepalive: options?.keepalive,
      })
    } catch (cleanupError) {
      console.warn("Temporary upload cleanup failed", cleanupError)
    }
  }

  useEffect(() => {
    pendingLocalAssetsRef.current = Object.values(uploads).flatMap((upload) =>
      upload.source === "local" ? [toCleanupAsset(upload)] : []
    )
  }, [uploads])

  useEffect(() => {
    return () => {
      stopCaptureStream()

      if (skipPendingCleanupRef.current || pendingLocalAssetsRef.current.length === 0) {
        return
      }

      void fetch(`/api/client/${token}/documents/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: pendingLocalAssetsRef.current }),
        keepalive: true,
      }).catch((cleanupError) => {
        console.warn("Temporary upload cleanup failed", cleanupError)
      })
    }
  }, [token])

  useEffect(() => {
    if (activeCaptureSlotKey && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => undefined)
    }
  }, [activeCaptureSlotKey])

  if (requirements.length === 0) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{t("noUploadsRequired")}</p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            onClick={() => {
              router.push(`/t/${token}/${skipStep}`)
            }}
          >
            {t("continueBtn")}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  async function handleFileChange(
    slotKey: string,
    file: File,
    options?: {
      slotIndex?: number
      slotLabel?: string | null
      source?: "UPLOAD" | "LIVE_CAPTURE"
      capturedAt?: string | null
    }
  ) {
    const previousUpload = uploads[slotKey]

    setError(null)
    setUploadingState((prev) => ({ ...prev, [slotKey]: true }))

    try {
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: getClientDocumentUploadFolder(token),
        }),
      })

      if (!sigRes.ok) {
        setError(t("uploadSigningError"))
        return
      }

      const { timestamp, signature, apiKey, cloudName, folder } = await sigRes.json()

      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", apiKey)
      formData.append("timestamp", timestamp.toString())
      formData.append("signature", signature)
      if (folder) formData.append("folder", folder)

      const uploadEndpoint = isPdfFile(file) ? "raw" : "auto"
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${uploadEndpoint}/upload`,
        {
          method: "POST",
          body: formData,
        }
      )

      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setError(uploadData?.error?.message ?? t("uploadFailed"))
        return
      }

      const nextUpload: LocalUploadEntry = {
        source: "local",
        slotIndex: options?.slotIndex ?? 0,
        slotLabel: options?.slotLabel ?? null,
        capturedAt: options?.capturedAt ?? null,
        uploadSource: options?.source ?? "UPLOAD",
        secure_url: uploadData.secure_url,
        public_id: uploadData.public_id,
        original_filename: file.name,
      }

      setUploads((prev) => ({
        ...prev,
        [slotKey]: nextUpload,
      }))

      if (previousUpload?.source === "local" && previousUpload.public_id !== nextUpload.public_id) {
        void cleanupTemporaryAssets([toCleanupAsset(previousUpload)])
      }
    } catch (uploadError) {
      console.error(uploadError)
      setError(t("uploadFailed"))
    } finally {
      setUploadingState((prev) => ({ ...prev, [slotKey]: false }))
    }
  }

  async function handleRemoveUpload(slotKey: string) {
    const currentUpload = uploads[slotKey]

    if (!currentUpload) {
      return
    }

    setError(null)
    setDeletingState((prev) => ({ ...prev, [slotKey]: true }))

    try {
      if (currentUpload.source === "saved") {
        const response = await fetch(`/api/client/${token}/documents/${currentUpload.documentId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          if (response.status === 410) {
            router.replace(`/t/${token}/cancelled`)
            return
          }

          const payload = await response.json().catch(() => null)
          setError(payload?.message ?? t("removeFileError"))
          return
        }

        setSavedUploads((prev) => {
          const next = { ...prev }
          delete next[slotKey]
          return next
        })

        setUploads((prev) => {
          const next = { ...prev }
          delete next[slotKey]
          return next
        })

        return
      }

      await cleanupTemporaryAssets([toCleanupAsset(currentUpload)])

      setUploads((prev) => {
        const next = { ...prev }
        const fallbackSavedUpload = savedUploads[slotKey]

        if (fallbackSavedUpload) {
          next[slotKey] = fallbackSavedUpload
        } else {
          delete next[slotKey]
        }

        return next
      })
    } catch (removeError) {
      console.error(removeError)
      setError(t("removeFileError"))
    } finally {
      setDeletingState((prev) => ({ ...prev, [slotKey]: false }))
    }
  }

  async function handleCaptureUpload(
    requirementId: string,
    slotIndex: number,
    slotLabel: string
  ) {
    const slotKey = getSlotKey(requirementId, slotIndex)

    if (!videoRef.current) {
      setCameraErrorBySlot((current) => ({ ...current, [slotKey]: t("cameraRequired") }))
      return
    }

    try {
      const capturedAt = new Date()
      const file = await createStampedCaptureFile(videoRef.current, capturedAt)
      await handleFileChange(slotKey, file, {
        slotIndex,
        slotLabel,
        source: "LIVE_CAPTURE",
        capturedAt: capturedAt.toISOString(),
      })
      stopCaptureStream()
      setActiveCaptureSlotKey(null)
    } catch (captureError) {
      console.error(captureError)
      setCameraErrorBySlot((current) => ({ ...current, [slotKey]: t("captureFailed") }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submission.start()
    setError(null)

    const docsPayload = requirements.reduce<Array<Record<string, string | number>>>((payload, requirement) => {
      if (requirement.type === "TEXT") {
        const textValue = textInputs[requirement.id]?.trim()

        if (!textValue) {
          return payload
        }

        payload.push({
          requirementId: requirement.id,
          label: requirement.label,
          type: requirement.type,
          textValue,
        })

        return payload
      }

      const slotLabels = getSlotLabels(requirement)

      for (let slotIndex = 0; slotIndex < slotLabels.length; slotIndex += 1) {
        const slotKey = getSlotKey(requirement.id, slotIndex)
        const upload = uploads[slotKey]

        if (!upload) {
          continue
        }

        payload.push({
          secure_url: upload.secure_url,
          public_id: upload.public_id,
          original_filename: upload.original_filename,
          requirementId: requirement.id,
          label: requirement.label,
          type: requirement.type,
          slotIndex,
          slotLabel: slotLabels[slotIndex] ?? "",
          source: upload.uploadSource,
          capturedAt: upload.capturedAt ?? "",
        })
      }

      return payload
    }, [])

    try {
      const res = await fetch(`/api/client/${token}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: docsPayload }),
      })

      if (res.ok) {
        const payload = await res.json()
        skipPendingCleanupRef.current = true
        submission.keepLocked()
        router.push(`/t/${token}/${payload.nextStep ?? "kyc"}`)
      } else {
        if (res.status === 410) {
          submission.keepLocked()
          router.replace(`/t/${token}/cancelled`)
          return
        }

        const payload = await res.json().catch(() => null)
        setError(payload?.message ?? t("uploadError"))
      }
    } catch (err) {
      console.error(err)
      setError(t("uploadError"))
    } finally {
      submission.finish()
    }
  }

  const hasPendingMutations =
    Object.values(uploadingState).some(Boolean) ||
    Object.values(deletingState).some(Boolean) ||
    Boolean(activeCaptureSlotKey) ||
    Boolean(startingCameraKey)

  const allRequiredMet = requirements
    .filter((requirement) => requirement.required)
    .every((requirement) => {
      if (requirement.type === "TEXT") {
        return Boolean(textInputs[requirement.id]?.trim())
      }

      const slotLabels = getSlotLabels(requirement)
      return slotLabels.every((_, slotIndex) => Boolean(uploads[getSlotKey(requirement.id, slotIndex)]))
    })

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {requirements.map((req) => {
            const slotLabels = getSlotLabels(req)
            const isComplete =
              req.type === "TEXT"
                ? Boolean(textInputs[req.id]?.trim())
                : slotLabels.every((_, slotIndex) =>
                    Boolean(uploads[getSlotKey(req.id, slotIndex)])
                  )

            return (
              <div key={req.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium">
                        {req.label} {req.required && <span className="text-destructive">*</span>}
                      </h4>
                      <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {translatedCategoryLabel(req.category, req.customCategoryLabel)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {req.type === "TEXT"
                        ? t("textResponse")
                        : req.type === "CAPTURE"
                          ? t("captureUpload")
                        : req.type === "PHOTO"
                          ? t("photoUpload")
                          : t("documentUpload")}
                    </p>
                    {req.instructions ? (
                      <p className="mt-1 text-xs text-muted-foreground">{req.instructions}</p>
                    ) : null}
                  </div>

                  {isComplete ? <CheckCircle2 className="size-5 text-green-500" /> : null}
                </div>

                {req.type !== "TEXT" && req.exampleImageUrl ? (
                  <RequirementExamplePreview
                    assetUrl={req.exampleImageUrl}
                    fileName={req.exampleImageFileName ?? req.label}
                    label={req.label}
                  />
                ) : null}

                {req.type === "TEXT" ? (
                  <div className="space-y-2">
                    <Textarea
                      value={textInputs[req.id] ?? ""}
                      onChange={(event) =>
                        setTextInputs((current) => ({
                          ...current,
                          [req.id]: event.target.value,
                        }))
                      }
                      placeholder={translatedTextPlaceholder(req.category)}
                      maxLength={INPUT_LIMITS.checklistItemInstructions}
                      className="min-h-[104px] resize-none bg-white"
                    />
                    <CharacterCount
                      current={(textInputs[req.id] ?? "").length}
                      limit={INPUT_LIMITS.checklistItemInstructions}
                      className="text-right"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slotLabels.map((slotLabel, slotIndex) => {
                      const slotKey = getSlotKey(req.id, slotIndex)
                      const currentUpload = uploads[slotKey]
                      const isUploading = Boolean(uploadingState[slotKey])
                      const isDeleting = Boolean(deletingState[slotKey])
                      const isCaptureSlot = req.type === "CAPTURE"
                      const isStartingCamera = startingCameraKey === slotKey
                      const isActiveCapture = activeCaptureSlotKey === slotKey
                      const uploadHref =
                        currentUpload &&
                        (resolveDocumentAssetUrl(
                          currentUpload.secure_url,
                          currentUpload.original_filename
                        ) ?? currentUpload.secure_url)
                      const captureTimestamp = formatCaptureTimestamp(currentUpload?.capturedAt ?? null)
                      const cameraError = cameraErrorBySlot[slotKey]

                      return (
                        <div key={slotKey} className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{slotLabel}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {isCaptureSlot
                                  ? t("captureSlotHint")
                                  : req.type === "PHOTO"
                                    ? t("imagesOnly")
                                    : t("pdfOrImage")}
                              </p>
                            </div>
                            {currentUpload ? <CheckCircle2 className="size-4 text-green-500" /> : null}
                          </div>

                          {currentUpload ? (
                            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                  <p className="truncate text-sm font-medium text-emerald-900">
                                    {currentUpload.original_filename}
                                  </p>
                                  <p className="text-xs text-emerald-700/90">
                                    {currentUpload.source === "saved" ? t("savedUpload") : t("newUploadReady")}
                                  </p>
                                  {captureTimestamp ? (
                                    <p className="text-xs text-emerald-700/90">
                                      {t("capturedAt", { value: captureTimestamp })}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <a
                                  href={uploadHref ?? currentUpload.secure_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
                                  )}
                                >
                                  <Eye className="size-3.5" />
                                  {t("viewFile")}
                                </a>

                                {isCaptureSlot ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
                                    onClick={() => void startCaptureForSlot(slotKey)}
                                    disabled={isUploading || isDeleting || submission.isLocked || isStartingCamera}
                                  >
                                    {isStartingCamera ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCcw className="size-3.5" />
                                    )}
                                    {isStartingCamera ? t("startingCamera") : t("retakePhoto")}
                                  </Button>
                                ) : (
                                  <label
                                    className={cn(
                                      buttonVariants({ variant: "outline", size: "sm" }),
                                      "relative cursor-pointer overflow-hidden border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900",
                                      (isUploading || isDeleting || submission.isLocked) &&
                                        "pointer-events-none opacity-60"
                                    )}
                                  >
                                    <input
                                      type="file"
                                      className="absolute inset-0 cursor-pointer opacity-0"
                                      onChange={(event) => {
                                        const nextFile = event.target.files?.[0]

                                        if (nextFile) {
                                          void handleFileChange(slotKey, nextFile, {
                                            slotIndex,
                                            slotLabel,
                                            source: "UPLOAD",
                                          })
                                        }

                                        event.target.value = ""
                                      }}
                                      disabled={isUploading || isDeleting || submission.isLocked}
                                      accept={req.type === "PHOTO" ? "image/*" : "image/*,.pdf"}
                                    />
                                    {isUploading ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <UploadCloud className="size-3.5" />
                                    )}
                                    {isUploading ? t("replacingFile") : t("replaceFile")}
                                  </label>
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => void handleRemoveUpload(slotKey)}
                                  disabled={isUploading || isDeleting || submission.isLocked}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3.5" />
                                  )}
                                  {isDeleting ? t("removingFile") : t("removeFile")}
                                </Button>
                              </div>

                              {isCaptureSlot && isActiveCapture ? (
                                <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-white/80 p-3">
                                  <div className="overflow-hidden rounded-xl border border-border/70 bg-black">
                                    <video
                                      ref={videoRef}
                                      autoPlay
                                      muted
                                      playsInline
                                      className="aspect-[4/3] w-full object-cover"
                                    />
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-[var(--contrazy-teal)]/30 bg-white text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10"
                                      onClick={() => void handleCaptureUpload(req.id, slotIndex, slotLabel)}
                                      disabled={submission.isLocked || isUploading}
                                    >
                                      {isUploading ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Camera className="size-3.5" />
                                      )}
                                      {isUploading ? t("capturingPhoto") : t("capturePhoto")}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cancelCaptureForSlot(slotKey)}
                                      disabled={submission.isLocked || isUploading}
                                    >
                                      <XCircle className="size-3.5" />
                                      {t("cancelCamera")}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              {isCaptureSlot && cameraError ? (
                                <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                                  <p>{cameraError}</p>
                                </div>
                              ) : null}
                            </div>
                          ) : isCaptureSlot ? (
                            <div className="space-y-3">
                              {isActiveCapture ? (
                                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <div className="overflow-hidden rounded-xl border border-border/70 bg-black">
                                    <video
                                      ref={videoRef}
                                      autoPlay
                                      muted
                                      playsInline
                                      className="aspect-[4/3] w-full object-cover"
                                    />
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-[var(--contrazy-teal)]/30 bg-white text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10"
                                      onClick={() => void handleCaptureUpload(req.id, slotIndex, slotLabel)}
                                      disabled={submission.isLocked || isUploading}
                                    >
                                      {isUploading ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Camera className="size-3.5" />
                                      )}
                                      {isUploading ? t("capturingPhoto") : t("capturePhoto")}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cancelCaptureForSlot(slotKey)}
                                      disabled={submission.isLocked || isUploading}
                                    >
                                      <XCircle className="size-3.5" />
                                      {t("cancelCamera")}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-xl border-2 border-dashed border-border/70 p-4 text-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => void startCaptureForSlot(slotKey)}
                                    disabled={submission.isLocked || isStartingCamera}
                                  >
                                    {isStartingCamera ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Camera className="size-4" />
                                    )}
                                    {isStartingCamera ? t("startingCamera") : t("startCamera")}
                                  </Button>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {t("captureOnlyHint")}
                                  </p>
                                </div>
                              )}

                              {cameraError ? (
                                <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                                  <p>{cameraError}</p>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="file"
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0]

                                  if (nextFile) {
                                    void handleFileChange(slotKey, nextFile, {
                                      slotIndex,
                                      slotLabel,
                                      source: "UPLOAD",
                                    })
                                  }

                                  event.target.value = ""
                                }}
                                disabled={isUploading || submission.isLocked}
                                accept={req.type === "PHOTO" ? "image/*" : "image/*,.pdf"}
                              />
                              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 p-4 text-center transition-colors hover:bg-muted/50">
                                {isUploading ? (
                                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                ) : (
                                  <>
                                    <UploadCloud className="mb-2 size-6 text-muted-foreground" />
                                    <span className="text-sm font-medium text-primary">
                                      {t("clickToUpload")}
                                    </span>
                                    <span className="mt-1 text-xs text-muted-foreground">
                                      {req.type === "PHOTO" ? t("imagesOnly") : t("pdfOrImage")}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={submission.isLocked || hasPendingMutations || !allRequiredMet}
          >
            {submission.isLocked ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("continueBtn")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
