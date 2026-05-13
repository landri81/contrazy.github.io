"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Eye, Loader2, Trash2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { useRouter } from "@/i18n/navigation"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type ReportField = {
  id: string
  label: string
  instructions: string | null
  fieldType: string
  selectOptions: unknown
}

type PriorReport = {
  responses: Array<{ fieldId: string; value: string }>
  assets: Array<{ assetUrl: string; fileName: string; publicId: string }>
} | null

type UploadedPhoto = {
  secure_url: string
  public_id: string
  original_filename: string
}

type CleanupAsset = {
  publicId: string
  assetUrl: string
  fileName: string
}

function toCleanupAsset(photo: UploadedPhoto): CleanupAsset {
  return { publicId: photo.public_id, assetUrl: photo.secure_url, fileName: photo.original_filename }
}

export function ClientReportForm({
  token,
  reportType,
  fields,
  priorReport,
  nextStep,
}: {
  token: string
  reportType: "CHECK_IN" | "CHECK_OUT"
  fields: ReportField[]
  priorReport: PriorReport
  nextStep: string
}) {
  const router = useRouter()
  const submission = useSubmissionLock()

  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.id, ""]))
  )
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingPhotosRef = useRef<CleanupAsset[]>([])
  const skipCleanupRef = useRef(false)

  useEffect(() => {
    pendingPhotosRef.current = photos.map(toCleanupAsset)
  }, [photos])

  useEffect(() => {
    return () => {
      if (skipCleanupRef.current || pendingPhotosRef.current.length === 0) return
      void fetch(`/api/client/${token}/report-assets/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: pendingPhotosRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [token])

  function updateValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  async function handlePhotoChange(file: File, replaceIndex?: number) {
    setError(null)
    setUploadingIndex(replaceIndex ?? photos.length)

    try {
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: getClientReportUploadFolder(token, reportType) }),
      })

      if (!sigRes.ok) {
        setError("Upload signing failed. Please try again.")
        return
      }

      const { timestamp, signature, apiKey, cloudName, folder } = await sigRes.json()
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", apiKey)
      formData.append("timestamp", timestamp.toString())
      formData.append("signature", signature)
      if (folder) formData.append("folder", folder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: formData }
      )
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setError(uploadData?.error?.message ?? "Upload failed. Please try again.")
        return
      }

      const newPhoto: UploadedPhoto = {
        secure_url: uploadData.secure_url,
        public_id: uploadData.public_id,
        original_filename: file.name,
      }

      setPhotos((prev) => {
        if (replaceIndex !== undefined) {
          const next = [...prev]
          // cleanup old
          void fetch(`/api/client/${token}/report-assets/cleanup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assets: [toCleanupAsset(prev[replaceIndex]!)] }),
          }).catch(() => {})
          next[replaceIndex] = newPhoto
          return next
        }
        return [...prev, newPhoto]
      })
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploadingIndex(null)
    }
  }

  async function handleRemovePhoto(index: number) {
    const photo = photos[index]
    if (!photo) return

    void fetch(`/api/client/${token}/report-assets/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: [toCleanupAsset(photo)] }),
    }).catch(() => {})

    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function validate() {
    for (const field of fields) {
      const val = values[field.id]?.trim() ?? ""
      if (!val) return `"${field.label}" is required.`
      if (field.fieldType === "NUMBER" && !Number.isFinite(Number(val))) {
        return `"${field.label}" must be a valid number.`
      }
      if (field.fieldType === "SELECT") {
        const opts = parseTransactionCustomFieldSelectOptions(field.selectOptions)
        if (!opts.includes(val)) return `Choose an option for "${field.label}".`
      }
    }
    if (photos.length === 0) {
      return "At least one photo is required."
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    submission.start()

    try {
      const endpoint = reportType === "CHECK_IN"
        ? `/api/client/${token}/check-in`
        : `/api/client/${token}/check-out`

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: fields.map((f) => ({
            fieldId: f.id,
            value: values[f.id]?.trim() ?? "",
          })),
          photos: photos.map((p, idx) => ({
            assetUrl: p.secure_url,
            publicId: p.public_id,
            fileName: p.original_filename,
            sortOrder: idx,
          })),
        }),
      })

      if (res.ok) {
        const payload = await res.json()
        skipCleanupRef.current = true
        submission.keepLocked()
        router.push(`/t/${token}/${payload.nextStep ?? nextStep}`)
        return
      }

      if (res.status === 410) {
        submission.keepLocked()
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const payload = await res.json().catch(() => null)
      setError(payload?.message ?? "Unable to submit report. Please try again.")
    } catch {
      setError("Unable to submit report. Please try again.")
    } finally {
      submission.finish()
    }
  }

  const isCheckOut = reportType === "CHECK_OUT"
  const priorFieldValues = priorReport
    ? new Map(priorReport.responses.map((r) => [r.fieldId, r.value]))
    : null

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
                ? "Record the return condition. Prior check-in values are shown for comparison."
                : "Record current readings and condition before the service begins."}
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

            {/* Fields */}
            {fields.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Fields
                </p>
                {fields.map((field) => {
                  const selectOpts = parseTransactionCustomFieldSelectOptions(field.selectOptions)
                  const priorValue = priorFieldValues?.get(field.id)

                  return (
                    <div key={field.id} className="grid gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Label
                          htmlFor={`report-field-${field.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                        >
                          {field.label} <span className="text-destructive">*</span>
                        </Label>
                        {isCheckOut && priorValue && (
                          <span className="text-xs text-muted-foreground">
                            Check-in: <span className="font-medium text-foreground">{priorValue}</span>
                          </span>
                        )}
                      </div>

                      {field.instructions?.trim() ? (
                        <p className="text-sm text-muted-foreground">{field.instructions}</p>
                      ) : null}

                      {field.fieldType === "SELECT" ? (
                        <Select
                          value={values[field.id] ?? ""}
                          onValueChange={(val) => updateValue(field.id, val ?? "")}
                        >
                          <SelectTrigger
                            id={`report-field-${field.id}`}
                            className="h-11 rounded-lg border-slate-200 bg-slate-50/60 shadow-none focus-visible:bg-white"
                          >
                            <span className="truncate text-left">
                              {values[field.id]?.trim() || "Choose an option"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {selectOpts.map((opt) => (
                              <SelectItem key={opt} value={opt} className="cursor-pointer">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`report-field-${field.id}`}
                          type={field.fieldType === "NUMBER" ? "number" : "text"}
                          step={field.fieldType === "NUMBER" ? "any" : undefined}
                          maxLength={INPUT_LIMITS.transactionCustomFieldValue}
                          className="h-11 rounded-lg border-slate-200 bg-slate-50/60 shadow-none focus-visible:bg-white"
                          placeholder={field.fieldType === "NUMBER" ? "Enter a number" : "Enter a value"}
                          value={values[field.id] ?? ""}
                          onChange={(e) => updateValue(field.id, e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* Photos */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Photos <span className="text-destructive">*</span>
              </p>

              {/* Prior check-in photos for comparison on check-out */}
              {isCheckOut && priorReport && priorReport.assets.length > 0 ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">
                    Check-in photos (for reference)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {priorReport.assets.map((asset, i) => (
                      <a
                        key={i}
                        href={asset.assetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs text-sky-800 hover:bg-sky-100"
                      >
                        <Eye className="size-3" />
                        {asset.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Uploaded photos */}
              {photos.length > 0 ? (
                <div className="space-y-2">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.public_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        <span className="truncate text-sm font-medium text-emerald-900">
                          {photo.original_filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={photo.secure_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                        >
                          <Eye className="size-4" />
                        </a>
                        <label className="relative cursor-pointer rounded p-1 text-emerald-700 hover:bg-emerald-100">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0"
                            disabled={uploadingIndex !== null || submission.isLocked}
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) void handlePhotoChange(f, index)
                              e.target.value = ""
                            }}
                          />
                          {uploadingIndex === index ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <UploadCloud className="size-4" />
                          )}
                        </label>
                        <button
                          type="button"
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          onClick={() => void handleRemovePhoto(index)}
                          disabled={uploadingIndex !== null || submission.isLocked}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Add photo upload zone */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={uploadingIndex !== null || submission.isLocked}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handlePhotoChange(f)
                    e.target.value = ""
                  }}
                />
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 p-4 text-center transition-colors hover:bg-muted/50">
                  {uploadingIndex !== null && uploadingIndex === photos.length ? (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <UploadCloud className="mb-2 size-6 text-muted-foreground" />
                      <span className="text-sm font-medium text-primary">
                        {photos.length === 0 ? "Upload a photo" : "Add another photo"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">Images only</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
              disabled={submission.isLocked || uploadingIndex !== null}
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
