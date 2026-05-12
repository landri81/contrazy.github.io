"use client"

import type { DocumentAsset, RequirementType, TransactionRequirement } from "@prisma/client"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  Trash2,
  UploadCloud,
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
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { isPdfFile, resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"

type SavedUploadEntry = {
  source: "saved"
  documentId: string
  secure_url: string
  public_id: string
  original_filename: string
}

type LocalUploadEntry = {
  source: "local"
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

    const savedUpload: SavedUploadEntry = {
      source: "saved",
      documentId: document.id,
      secure_url: document.assetUrl,
      public_id: document.publicId,
      original_filename: document.fileName || document.label,
    }

    savedUploads[document.requirementId] = savedUpload
    uploads[document.requirementId] = savedUpload
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
  const pendingLocalAssetsRef = useRef<CleanupAssetPayload[]>([])
  const skipPendingCleanupRef = useRef(false)

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

  async function handleFileChange(reqId: string, file: File) {
    const previousUpload = uploads[reqId]

    setError(null)
    setUploadingState((prev) => ({ ...prev, [reqId]: true }))

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
        secure_url: uploadData.secure_url,
        public_id: uploadData.public_id,
        original_filename: file.name,
      }

      setUploads((prev) => ({
        ...prev,
        [reqId]: nextUpload,
      }))

      if (previousUpload?.source === "local" && previousUpload.public_id !== nextUpload.public_id) {
        void cleanupTemporaryAssets([toCleanupAsset(previousUpload)])
      }
    } catch (uploadError) {
      console.error(uploadError)
      setError(t("uploadFailed"))
    } finally {
      setUploadingState((prev) => ({ ...prev, [reqId]: false }))
    }
  }

  async function handleRemoveUpload(reqId: string) {
    const currentUpload = uploads[reqId]

    if (!currentUpload) {
      return
    }

    setError(null)
    setDeletingState((prev) => ({ ...prev, [reqId]: true }))

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
          delete next[reqId]
          return next
        })

        setUploads((prev) => {
          const next = { ...prev }
          delete next[reqId]
          return next
        })

        return
      }

      await cleanupTemporaryAssets([toCleanupAsset(currentUpload)])

      setUploads((prev) => {
        const next = { ...prev }
        const fallbackSavedUpload = savedUploads[reqId]

        if (fallbackSavedUpload) {
          next[reqId] = fallbackSavedUpload
        } else {
          delete next[reqId]
        }

        return next
      })
    } catch (removeError) {
      console.error(removeError)
      setError(t("removeFileError"))
    } finally {
      setDeletingState((prev) => ({ ...prev, [reqId]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submission.start()
    setError(null)

    const docsPayload = requirements.reduce<Array<Record<string, string>>>((payload, requirement) => {
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

      const upload = uploads[requirement.id]

      if (!upload) {
        return payload
      }

      payload.push({
        secure_url: upload.secure_url,
        public_id: upload.public_id,
        original_filename: upload.original_filename,
        requirementId: requirement.id,
        label: requirement.label,
        type: requirement.type,
      })

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
    Object.values(uploadingState).some(Boolean) || Object.values(deletingState).some(Boolean)

  const allRequiredMet = requirements
    .filter((requirement) => requirement.required)
    .every((requirement) =>
      requirement.type === "TEXT"
        ? Boolean(textInputs[requirement.id]?.trim())
        : Boolean(uploads[requirement.id])
    )

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
            const currentUpload = uploads[req.id]
            const isComplete =
              req.type === "TEXT"
                ? Boolean(textInputs[req.id]?.trim())
                : Boolean(currentUpload)
            const isUploading = Boolean(uploadingState[req.id])
            const isDeleting = Boolean(deletingState[req.id])
            const uploadHref =
              currentUpload &&
              (resolveDocumentAssetUrl(
                currentUpload.secure_url,
                currentUpload.original_filename
              ) ?? currentUpload.secure_url)

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
                ) : currentUpload ? (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-emerald-900">
                          {currentUpload.original_filename}
                        </p>
                        <p className="text-xs text-emerald-700/90">
                          {currentUpload.source === "saved"
                            ? t("savedUpload")
                            : t("newUploadReady")}
                        </p>
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
                              void handleFileChange(req.id, nextFile)
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

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleRemoveUpload(req.id)}
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
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0]

                        if (nextFile) {
                          void handleFileChange(req.id, nextFile)
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
