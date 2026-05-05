"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { CharacterCount } from "@/components/ui/character-count"
import { Textarea } from "@/components/ui/textarea"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { isPdfFile } from "@/lib/integrations/cloudinary-assets"
import { getRequirementCategoryLabel, getTextRequirementPlaceholder } from "@/features/transactions/contract-flow"

export function ClientUploadsForm({
  token,
  requirements,
  skipStep,
}: {
  token: string
  requirements: import("@prisma/client").TransactionRequirement[]
  skipStep: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<
    Record<string, { secure_url: string; public_id: string; original_filename: string }>
  >({})
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({})

  // If there are no requirements, we should ideally skip this step
  if (requirements.length === 0) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No uploads required.</p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            onClick={() => {
              router.push(`/t/${token}/${skipStep}`)
            }}
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    )
  }

  async function handleFileChange(reqId: string, file: File) {
    setError(null)
    setUploadingState(prev => ({ ...prev, [reqId]: true }))
    try {
      // 1. Get signature from our backend
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload", { method: "POST" })
      if (!sigRes.ok) {
        setError("Upload signing is unavailable right now. Please try again.")
        return
      }
      const { timestamp, signature, apiKey, cloudName, folder } = await sigRes.json()

      // 2. Upload directly to Cloudinary
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", apiKey)
      formData.append("timestamp", timestamp.toString())
      formData.append("signature", signature)
      if (folder) formData.append("folder", folder)

      const uploadEndpoint = isPdfFile(file) ? "raw" : "auto"
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${uploadEndpoint}/upload`, {
        method: "POST",
        body: formData,
      })

      const uploadData = await uploadRes.json()

      if (uploadRes.ok) {
        setUploads(prev => ({
          ...prev,
          [reqId]: {
            secure_url: uploadData.secure_url,
            public_id: uploadData.public_id,
            original_filename: file.name
          }
        }))
      } else {
        setError(uploadData?.error?.message ?? "Upload failed. Please try again.")
      }
    } catch (e) {
      console.error(e)
      setError("Upload failed. Please try again.")
    } finally {
      setUploadingState(prev => ({ ...prev, [reqId]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
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
        ...upload,
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
        body: JSON.stringify({ documents: docsPayload })
      })

      if (res.ok) {
        const payload = await res.json()
        router.push(`/t/${token}/${payload.nextStep ?? "kyc"}`)
      } else {
        if (res.status === 410) {
          router.replace(`/t/${token}/cancelled`)
          return
        }

        const payload = await res.json().catch(() => null)
        setError(payload?.message ?? "Unable to save documents right now.")
      }
    } catch (err) {
      console.error(err)
      setError("Unable to save documents right now.")
    } finally {
      setIsPending(false)
    }
  }

  // Check if all required uploads have a corresponding file or text answer
  const allRequiredMet = requirements
    .filter(r => r.required)
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
          {requirements.map((req) => (
            <div key={req.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium text-sm">
                      {req.label} {req.required && <span className="text-destructive">*</span>}
                    </h4>
                    <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {getRequirementCategoryLabel(req.category, req.customCategoryLabel)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {req.type === "TEXT" ? "Text response" : req.type === "PHOTO" ? "Photo upload" : "Document upload"}
                  </p>
                  {req.instructions && (
                    <p className="text-xs text-muted-foreground mt-1">{req.instructions}</p>
                  )}
                </div>
                {(req.type === "TEXT" ? Boolean(textInputs[req.id]?.trim()) : Boolean(uploads[req.id])) && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>

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
                    placeholder={getTextRequirementPlaceholder(req.category)}
                    maxLength={INPUT_LIMITS.checklistItemInstructions}
                    className="min-h-[104px] resize-none bg-white"
                  />
                  <CharacterCount
                    current={(textInputs[req.id] ?? "").length}
                    limit={INPUT_LIMITS.checklistItemInstructions}
                    className="text-right"
                  />
                </div>
              ) : uploads[req.id] ? (
                <div className="truncate rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                  {uploads[req.id].original_filename}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(req.id, e.target.files[0])
                      }
                    }}
                    disabled={uploadingState[req.id]}
                    accept={req.type === 'PHOTO' ? 'image/*' : 'image/*,.pdf'}
                  />
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 p-4 text-center transition-colors hover:bg-muted/50">
                    {uploadingState[req.id] ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
                        <span className="text-sm font-medium text-primary">Click to upload</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {req.type === 'PHOTO' ? 'Images only' : 'PDF or Image'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-[var(--contrazy-navy)] text-white hover:bg-[var(--contrazy-navy-soft)]"
            disabled={isPending || !allRequiredMet}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
