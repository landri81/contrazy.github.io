"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

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
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload")
      if (!sigRes.ok) {
        setError("Upload signing is unavailable right now. Please try again.")
        return
      }
      const { timestamp, signature, apiKey, cloudName } = await sigRes.json()

      // 2. Upload directly to Cloudinary
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", apiKey)
      formData.append("timestamp", timestamp.toString())
      formData.append("signature", signature)
      // We don't have a specific folder configured, so upload to root or default

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
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

    // Map the uploads object into an array for the API
    const docsPayload = Object.keys(uploads).map(reqId => {
      const req = requirements.find(r => r.id === reqId)
      return {
        ...uploads[reqId],
        requirementId: reqId,
        label: req?.label,
        type: req?.type
      }
    })

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

  // Check if all required uploads have a corresponding file
  const allRequiredMet = requirements
    .filter(r => r.required)
    .every(r => uploads[r.id])

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
                  <h4 className="font-medium text-sm">
                    {req.label} {req.required && <span className="text-destructive">*</span>}
                  </h4>
                  {req.instructions && (
                    <p className="text-xs text-muted-foreground mt-1">{req.instructions}</p>
                  )}
                </div>
                {uploads[req.id] && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>

              {uploads[req.id] ? (
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
