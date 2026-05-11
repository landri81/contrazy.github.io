"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, LoaderCircle } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type VendorSignatureImageDialogProps = {
  transactionId: string
}

export function VendorSignatureImageDialog({
  transactionId,
}: VendorSignatureImageDialogProps) {
  const t = useTranslations("dashboard.vendor.signatures")
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const imageUrlRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  function revokePreviewUrl() {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      revokePreviewUrl()
    }
  }, [])

  async function loadPreview() {
    abortRef.current?.abort()
    revokePreviewUrl()
    setImageUrl(null)
    setError(null)
    setIsLoading(true)

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(`/api/vendor/signatures/${transactionId}/image`, {
        cache: "no-store",
        signal: controller.signal,
      })

      if (!response.ok) {
        if (requestId === requestIdRef.current) {
          setError(t("preview.unavailable"))
          setIsLoading(false)
        }
        return
      }

      const blob = await response.blob()

      if (!blob.type.startsWith("image/")) {
        if (requestId === requestIdRef.current) {
          setError(t("preview.unavailable"))
          setIsLoading(false)
        }
        return
      }

      const nextUrl = URL.createObjectURL(blob)

      if (requestId !== requestIdRef.current) {
        URL.revokeObjectURL(nextUrl)
        return
      }

      imageUrlRef.current = nextUrl
      setImageUrl(nextUrl)
      setIsLoading(false)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      if (requestId === requestIdRef.current) {
        console.error("Signature preview failed", error)
        setError(t("preview.failed"))
        setIsLoading(false)
      }
    }
  }

  function handleOpen() {
    setOpen(true)
    void loadPreview()
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      abortRef.current?.abort()
      setIsLoading(false)
      setError(null)
      setImageUrl(null)
      revokePreviewUrl()
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-lg px-3 text-xs"
        onClick={handleOpen}
      >
        {t("viewSignature")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[680px] overflow-hidden rounded-2xl p-0">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-base font-semibold">
                {t("preview.title")}
              </DialogTitle>
              <DialogDescription>
                {t("preview.description")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/70 bg-muted/20 p-4">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-5 animate-spin text-[var(--contrazy-teal)]" />
                  <span>{t("preview.loading")}</span>
                </div>
              ) : error ? (
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={t("preview.title")}
                  width={1200}
                  height={900}
                  unoptimized
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("preview.unavailable")}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
