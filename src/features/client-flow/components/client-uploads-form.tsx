"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UploadCloud, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function ClientUploadsForm({ token, requirements }: { token: string, requirements: import("@prisma/client").TransactionRequirement[] }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { secure_url: string, public_id: string, original_filename: string }>>({})
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({})

  // If there are no requirements, we should ideally skip this step
  if (requirements.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No uploads required.</p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => {
            router.push(`/t/${token}/kyc`)
            router.refresh()
          }}>
            Continue
          </Button>
        </CardFooter>
      </Card>
    )
  }

  async function handleFileChange(reqId: string, file: File) {
    setUploadingState(prev => ({ ...prev, [reqId]: true }))
    try {
      // 1. Get signature from our backend
      const sigRes = await fetch("/api/integrations/cloudinary/sign-upload")
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
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUploadingState(prev => ({ ...prev, [reqId]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)

    // Map the uploads object into an array for the API
    const docsPayload = Object.keys(uploads).map(reqId => {
      const req = requirements.find(r => r.id === reqId)
      return {
        ...uploads[reqId],
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
        router.push(`/t/${token}/kyc`)
        router.refresh()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsPending(false)
    }
  }

  // Check if all required uploads have a corresponding file
  const allRequiredMet = requirements
    .filter(r => r.required)
    .every(r => uploads[r.id])

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          {requirements.map((req) => (
            <div key={req.id} className="border rounded-lg p-4 bg-muted/20">
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
                <div className="text-xs bg-green-50 text-green-700 p-2 rounded truncate border border-green-200">
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
                  <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
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
          <Button type="submit" className="w-full" disabled={isPending || !allRequiredMet}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
