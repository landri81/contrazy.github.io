"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useSubmissionLock } from "@/features/client-flow/hooks/use-submission-lock"
import { getClientReportUploadFolder } from "@/features/client-flow/lib/client-document-uploads"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import {
  isReportFieldScalar,
  isReportFieldUpload,
  type TransactionReportFieldTypeValue,
} from "@/features/transactions/report-fields"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type ReportField = {
  id: string
  label: string
  instructions: string | null
  fieldType: string
  selectOptions: unknown
}

type PriorReportAsset = {
  fieldId: string | null
  assetUrl: string
  fileName: string
  publicId: string
  mimeType: string | null
}

type PriorReport = {
  responses: Array<{ fieldId: string; value: string }>
  assets: PriorReportAsset[]
} | null

type UploadedReportAsset = {
  secure_url: string
  public_id: string
  original_filename: string
  mimeType: string | null
}

type CleanupAsset = {
  publicId: string
  assetUrl: string
  fileName: string
}

function toCleanupAsset(asset: UploadedReportAsset): CleanupAsset {
  return {
    publicId: asset.public_id,
    assetUrl: asset.secure_url,
    fileName: asset.original_filename,
  }
}

function normalizeFieldLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function isImageAsset(asset: {
  mimeType: string | null
  fileName?: string
  original_filename?: string
}) {
  const fileName = asset.fileName ?? asset.original_filename ?? ""

  return (
    asset.mimeType?.startsWith("image/") === true ||
    /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(fileName)
  )
}

function toThumb(url: string) {
  if (!url.includes("/upload/")) return url
  return url.replace("/upload/", "/upload/w_600,h_450,c_fill,q_auto,f_auto/")
}

export function ClientReportForm({
  token,
  reportType,
  fields,
  priorReport,
  priorFields = [],
  nextStep,
}: {
  token: string
  reportType: "CHECK_IN" | "CHECK_OUT"
  fields: ReportField[]
  priorReport: PriorReport
  priorFields?: ReportField[]
  nextStep: string
}) {
  const router = useRouter()
  const submission = useSubmissionLock()

  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((field) => [field.id, ""]))
  )
  const [fieldAssets, setFieldAssets] = useState<Record<string, UploadedReportAsset[]>>(
    () =>
      Object.fromEntries(
        fields
          .filter((field) => isReportFieldUpload(field.fieldType))
          .map((field) => [field.id, [] as UploadedReportAsset[]])
      )
  )
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingAssetsRef = useRef<CleanupAsset[]>([])
  const skipCleanupRef = useRef(false)

  useEffect(() => {
    pendingAssetsRef.current = Object.values(fieldAssets)
      .flat()
      .map(toCleanupAsset)
  }, [fieldAssets])

  useEffect(() => {
    setFieldAssets((current) => {
      const next: Record<string, UploadedReportAsset[]> = {}

      for (const field of fields) {
        if (!isReportFieldUpload(field.fieldType)) {
          continue
        }

        next[field.id] = current[field.id] ?? []
      }

      return next
    })
  }, [fields])

  useEffect(() => {
    return () => {
      if (skipCleanupRef.current || pendingAssetsRef.current.length === 0) return

      void fetch(`/api/client/${token}/report-assets/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: pendingAssetsRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [token])

  const priorResponseMap = useMemo(
    () => new Map((priorReport?.responses ?? []).map((response) => [response.fieldId, response.value])),
    [priorReport]
  )

  const priorAssetsByFieldId = useMemo(() => {
    const next = new Map<string, PriorReportAsset[]>()

    for (const asset of priorReport?.assets ?? []) {
      if (!asset.fieldId) {
        continue
      }

      const current = next.get(asset.fieldId) ?? []
      current.push(asset)
      next.set(asset.fieldId, current)
    }

    return next
  }, [priorReport])

  const priorFieldByLabel = useMemo(
    () =>
      new Map(
        priorFields.map((field) => [normalizeFieldLabel(field.label), field] as const)
      ),
    [priorFields]
  )

  const legacyPriorAssets = useMemo(
    () => (priorReport?.assets ?? []).filter((asset) => !asset.fieldId),
    [priorReport]
  )

  function updateValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  function getAssetsForField(fieldId: string) {
    return fieldAssets[fieldId] ?? []
  }

  function getPriorValue(field: ReportField) {
    const priorField = priorFieldByLabel.get(normalizeFieldLabel(field.label))

    if (!priorField) {
      return null
    }

    return priorResponseMap.get(priorField.id) ?? null
  }

  function getPriorAssets(field: ReportField) {
    const priorField = priorFieldByLabel.get(normalizeFieldLabel(field.label))

    if (!priorField) {
      return []
    }

    return priorAssetsByFieldId.get(priorField.id) ?? []
  }

  async function signReportUploadFolder() {
    const response = await fetch("/api/integrations/cloudinary/sign-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: getClientReportUploadFolder(token, reportType) }),
    })

    if (!response.ok) {
      throw new Error("Upload signing failed. Please try again.")
    }

    return response.json() as Promise<{
      timestamp: number
      signature: string
      apiKey: string
      cloudName: string
      folder?: string | null
    }>
  }

  async function uploadAssetFile(
    file: File,
    uploadSignature: {
      timestamp: number
      signature: string
      apiKey: string
      cloudName: string
      folder?: string | null
    }
  ) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("api_key", uploadSignature.apiKey)
    formData.append("timestamp", uploadSignature.timestamp.toString())
    formData.append("signature", uploadSignature.signature)

    if (uploadSignature.folder) {
      formData.append("folder", uploadSignature.folder)
    }

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${uploadSignature.cloudName}/auto/upload`,
      { method: "POST", body: formData }
    )
    const uploadData = await uploadResponse.json()

    if (!uploadResponse.ok) {
      throw new Error(uploadData?.error?.message ?? "Upload failed. Please try again.")
    }

    return {
      secure_url: uploadData.secure_url as string,
      public_id: uploadData.public_id as string,
      original_filename: file.name,
      mimeType: file.type || null,
    } satisfies UploadedReportAsset
  }

  async function handleUploadFiles(field: ReportField, incomingFiles: FileList | File[]) {
    const files = Array.from(incomingFiles)

    if (files.length === 0) {
      return
    }

    const fieldType = field.fieldType as TransactionReportFieldTypeValue

    if (
      fieldType === "PHOTO" &&
      files.some((file) => !file.type.startsWith("image/"))
    ) {
      setError(`"${field.label}" only accepts image files.`)
      return
    }

    setError(null)
    setUploadingFieldId(field.id)

    try {
      const uploadSignature = await signReportUploadFolder()
      const uploadedAssets: UploadedReportAsset[] = []

      for (const file of files) {
        uploadedAssets.push(await uploadAssetFile(file, uploadSignature))
      }

      setFieldAssets((current) => ({
        ...current,
        [field.id]: [...(current[field.id] ?? []), ...uploadedAssets],
      }))
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed. Please try again."
      )
    } finally {
      setUploadingFieldId(null)
    }
  }

  async function handleRemoveAsset(fieldId: string, assetIndex: number) {
    const asset = getAssetsForField(fieldId)[assetIndex]

    if (!asset) {
      return
    }

    void fetch(`/api/client/${token}/report-assets/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: [toCleanupAsset(asset)] }),
    }).catch(() => {})

    setFieldAssets((current) => ({
      ...current,
      [fieldId]: (current[fieldId] ?? []).filter((_, index) => index !== assetIndex),
    }))
  }

  function validate() {
    for (const field of fields) {
      const fieldType = field.fieldType as TransactionReportFieldTypeValue

      if (isReportFieldScalar(fieldType)) {
        const value = values[field.id]?.trim() ?? ""

        if (!value) {
          return `"${field.label}" is required.`
        }

        if (fieldType === "NUMBER" && !Number.isFinite(Number(value))) {
          return `"${field.label}" must be a valid number.`
        }

        if (fieldType === "SELECT") {
          const options = parseTransactionCustomFieldSelectOptions(field.selectOptions)

          if (!options.includes(value)) {
            return `Choose an option for "${field.label}".`
          }
        }

        continue
      }

      if (getAssetsForField(field.id).length === 0) {
        return fieldType === "PHOTO"
          ? `Upload at least one photo for "${field.label}".`
          : `Upload at least one file for "${field.label}".`
      }
    }

    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    submission.start()

    try {
      const endpoint =
        reportType === "CHECK_IN"
          ? `/api/client/${token}/check-in`
          : `/api/client/${token}/check-out`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: fields
            .filter((field) => isReportFieldScalar(field.fieldType))
            .map((field) => ({
              fieldId: field.id,
              value: values[field.id]?.trim() ?? "",
            })),
          fieldAssets: fields
            .filter((field) => isReportFieldUpload(field.fieldType))
            .map((field) => ({
              fieldId: field.id,
              assets: getAssetsForField(field.id).map((asset, index) => ({
                assetUrl: asset.secure_url,
                publicId: asset.public_id,
                fileName: asset.original_filename,
                mimeType: asset.mimeType,
                sortOrder: index,
              })),
            })),
        }),
      })

      if (response.ok) {
        const payload = await response.json()
        skipCleanupRef.current = true
        submission.keepLocked()
        router.push(`/t/${token}/${payload.nextStep ?? nextStep}`)
        return
      }

      if (response.status === 410) {
        submission.keepLocked()
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await response.json().catch(() => null)
      setError(payload?.message ?? "Unable to submit report. Please try again.")
    } catch {
      setError("Unable to submit report. Please try again.")
    } finally {
      submission.finish()
    }
  }

  const isCheckOut = reportType === "CHECK_OUT"

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-lg border-white bg-white/95 py-0 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
        <form onSubmit={handleSubmit}>
          <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <CardTitle className="font-heading text-xl font-semibold tracking-tight">
              {isCheckOut ? "Check-Out Details" : "Check-In Details"}
            </CardTitle>
            <CardDescription>
              {isCheckOut
                ? "Record the return condition, final readings, and the requested uploads. Prior check-in values are shown where available."
                : "Record the current condition, readings, and the requested uploads before the service begins."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-5 sm:px-6">
            <AnimatePresence initial={false}>
              {error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {fields.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Fields
                </p>

                {fields.map((field) => {
                  const fieldType = field.fieldType as TransactionReportFieldTypeValue
                  const selectOptions = parseTransactionCustomFieldSelectOptions(
                    field.selectOptions
                  )
                  const priorValue = getPriorValue(field)
                  const priorAssets = getPriorAssets(field)
                  const currentAssets = getAssetsForField(field.id)
                  const isUploadingThisField = uploadingFieldId === field.id
                  const uploadLabel =
                    fieldType === "PHOTO" ? "Add photos" : "Add files"

                  return (
                    <div
                      key={field.id}
                      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Label
                            htmlFor={`report-field-${field.id}`}
                            className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                          >
                            {field.label} <span className="text-destructive">*</span>
                          </Label>
                          {field.instructions?.trim() ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {field.instructions}
                            </p>
                          ) : null}
                        </div>

                        {isCheckOut && priorValue ? (
                          <span className="text-right text-xs text-muted-foreground">
                            Check-in:{" "}
                            <span className="font-medium text-foreground">{priorValue}</span>
                          </span>
                        ) : null}
                      </div>

                      {fieldType === "SELECT" ? (
                        <Select
                          value={values[field.id] ?? ""}
                          onValueChange={(value) => updateValue(field.id, value ?? "")}
                        >
                          <SelectTrigger
                            id={`report-field-${field.id}`}
                            className="h-11 rounded-lg border-slate-200 bg-white shadow-none focus-visible:bg-white"
                          >
                            <span className="truncate text-left">
                              {values[field.id]?.trim() || "Choose an option"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {selectOptions.map((option) => (
                              <SelectItem
                                key={option}
                                value={option}
                                className="cursor-pointer"
                              >
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isReportFieldScalar(fieldType) ? (
                        <Input
                          id={`report-field-${field.id}`}
                          type={fieldType === "NUMBER" ? "number" : "text"}
                          step={fieldType === "NUMBER" ? "any" : undefined}
                          maxLength={INPUT_LIMITS.transactionCustomFieldValue}
                          className="h-11 rounded-lg border-slate-200 bg-white shadow-none focus-visible:bg-white"
                          placeholder={
                            fieldType === "NUMBER" ? "Enter a number" : "Enter a value"
                          }
                          value={values[field.id] ?? ""}
                          onChange={(event) => updateValue(field.id, event.target.value)}
                        />
                      ) : (
                        <div className="space-y-3">
                          {isCheckOut && priorAssets.length > 0 ? (
                            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">
                                Check-in uploads ({priorAssets.length})
                              </p>
                              <div
                                className={cn(
                                  "grid gap-2",
                                  fieldType === "PHOTO"
                                    ? "grid-cols-2 sm:grid-cols-3"
                                    : "grid-cols-1"
                                )}
                              >
                                {priorAssets.map((asset) =>
                                  fieldType === "PHOTO" && isImageAsset(asset) ? (
                                    <a
                                      key={`${asset.publicId}-${asset.fileName}`}
                                      href={asset.assetUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block overflow-hidden rounded-lg border border-sky-200 bg-white"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={toThumb(asset.assetUrl)}
                                        alt={asset.fileName}
                                        className="aspect-square w-full object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      key={`${asset.publicId}-${asset.fileName}`}
                                      href={asset.assetUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-800 hover:bg-sky-100"
                                    >
                                      <FileText className="size-4 shrink-0" />
                                      <span className="truncate">{asset.fileName}</span>
                                    </a>
                                  )
                                )}
                              </div>
                            </div>
                          ) : null}

                          {currentAssets.length > 0 ? (
                            <div
                              className={cn(
                                "grid gap-2",
                                fieldType === "PHOTO"
                                  ? "grid-cols-2 sm:grid-cols-3"
                                  : "grid-cols-1"
                              )}
                            >
                              {currentAssets.map((asset, assetIndex) => {
                                const imagePreview = fieldType === "PHOTO" && isImageAsset(asset)

                                return (
                                  <div
                                    key={`${asset.public_id}-${assetIndex}`}
                                    className={cn(
                                      "rounded-lg border border-emerald-200/80 bg-emerald-50/90",
                                      imagePreview ? "overflow-hidden" : "px-3 py-2"
                                    )}
                                  >
                                    {imagePreview ? (
                                      <div className="relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={toThumb(asset.secure_url)}
                                          alt={asset.original_filename}
                                          className="aspect-square w-full object-cover"
                                          loading="lazy"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-950/65 px-2 py-1.5 text-white">
                                          <span className="truncate text-xs font-medium">
                                            {asset.original_filename}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <a
                                              href={asset.secure_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="rounded p-1 hover:bg-white/10"
                                            >
                                              <Eye className="size-4" />
                                            </a>
                                            <button
                                              type="button"
                                              className="rounded p-1 hover:bg-white/10"
                                              onClick={() =>
                                                void handleRemoveAsset(field.id, assetIndex)
                                              }
                                              disabled={
                                                submission.isLocked ||
                                                uploadingFieldId !== null
                                              }
                                            >
                                              <Trash2 className="size-4" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Paperclip className="size-4 shrink-0 text-emerald-700" />
                                          <span className="truncate text-sm font-medium text-emerald-900">
                                            {asset.original_filename}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <a
                                            href={asset.secure_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                                          >
                                            <Eye className="size-4" />
                                          </a>
                                          <button
                                            type="button"
                                            className="rounded p-1 text-destructive hover:bg-destructive/10"
                                            onClick={() =>
                                              void handleRemoveAsset(field.id, assetIndex)
                                            }
                                            disabled={
                                              submission.isLocked || uploadingFieldId !== null
                                            }
                                          >
                                            <Trash2 className="size-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}

                          <div className="relative">
                            <input
                              id={`report-upload-${field.id}`}
                              type="file"
                              multiple
                              accept={fieldType === "PHOTO" ? "image/*" : undefined}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              disabled={submission.isLocked || uploadingFieldId !== null}
                              onChange={(event) => {
                                void handleUploadFiles(field, event.target.files ?? [])
                                event.target.value = ""
                              }}
                            />
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-white p-4 text-center transition-colors hover:bg-muted/35">
                              {isUploadingThisField ? (
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  {fieldType === "PHOTO" ? (
                                    <FileImage className="mb-2 size-6 text-muted-foreground" />
                                  ) : (
                                    <UploadCloud className="mb-2 size-6 text-muted-foreground" />
                                  )}
                                  <span className="text-sm font-medium text-primary">
                                    {uploadLabel}
                                  </span>
                                  <span className="mt-1 text-xs text-muted-foreground">
                                    {fieldType === "PHOTO"
                                      ? "You can upload multiple photos."
                                      : "You can upload multiple files."}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {isCheckOut && legacyPriorAssets.length > 0 ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">
                  Check-in legacy uploads ({legacyPriorAssets.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {legacyPriorAssets.map((asset) => (
                    <a
                      key={`${asset.publicId}-${asset.fileName}`}
                      href={asset.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-800 hover:bg-sky-100"
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{asset.fileName}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
              disabled={submission.isLocked || uploadingFieldId !== null}
            >
              {submission.isLocked ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {submission.isLocked
                ? "Submitting..."
                : isCheckOut
                  ? "Submit check-out"
                  : "Submit check-in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
