"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

type UploadedDoc = {
  publicId: string
  secureUrl: string
  originalFilename: string
}

export function ClientKycForm({ token, failed }: { token: string; failed?: boolean }) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null)

  async function handleFileChange(file: File) {
    if (!file) return
    setError(null)
    setUploaded(null)
    setIsUploading(true)

    try {
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload", { method: "POST" })
      if (!sigRes.ok) {
        setError("Upload service unavailable. Please try again.")
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

      setUploaded({
        publicId: uploadData.public_id,
        secureUrl: uploadData.secure_url,
        originalFilename: file.name,
      })
    } catch {
      setError("Upload failed. Please check your connection and try again.")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSubmit() {
    if (!uploaded || isSubmitting) return
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/client/${token}/kyc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: uploaded.publicId,
          secureUrl: uploaded.secureUrl,
          originalFilename: uploaded.originalFilename,
        }),
      })

      if (res.status === 410) {
        router.replace(`/t/${token}/cancelled`)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? "Submission failed. Please try again.")
        return
      }

      // Reload the KYC page — server will detect PENDING and redirect to next step
      router.push(`/t/${token}/kyc`)
      router.refresh()
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--contrazy-navy)/10">
            <ShieldCheck className="size-5 text-(--contrazy-navy)" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Identity Verification</p>
            <p className="text-sm text-muted-foreground">
              Upload a government-issued ID for review before proceeding.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-2">
        {/* Rejection notice */}
        {failed && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>Your previous document was not accepted. Please upload a new one.</p>
          </div>
        )}

        {/* Accepted documents info */}
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-foreground mb-1.5">Accepted documents</p>
          <ul className="space-y-1">
            {["Passport", "Driver's license (front & back)", "National identity card"].map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1 rounded-full bg-muted-foreground/60 shrink-0" />
                {doc}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Accepted formats: JPG, PNG, PDF &mdash; max 10 MB
          </p>
        </div>

        {/* Error */}
        <AnimatePresence initial={false}>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Upload area or preview */}
        {uploaded ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate">
                {uploaded.originalFilename}
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">Ready to submit</p>
            </div>
            <button
              type="button"
              onClick={() => { setUploaded(null); setError(null) }}
              className="shrink-0 rounded-md p-1 text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400/60 dark:hover:bg-emerald-900/40"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileChange(file)
                e.target.value = ""
              }}
              disabled={isUploading}
              accept="image/*,.pdf"
            />
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-8 text-center transition-colors hover:bg-muted/30">
              {isUploading ? (
                <>
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading…</p>
                </>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
                    <UploadCloud className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to upload your ID
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      or drag and drop a file here
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1">
                    <FileImage className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">JPG · PNG · PDF</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Your document will be reviewed securely. You can continue with the next steps while review is in progress.
        </p>
      </CardContent>

      <CardFooter className="px-5 pb-5 pt-3">
        <Button
          type="button"
          className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
          disabled={!uploaded || isUploading || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 size-4" />
          )}
          {isSubmitting ? "Submitting…" : "Submit for Review"}
        </Button>
      </CardFooter>
    </Card>
  )
}
