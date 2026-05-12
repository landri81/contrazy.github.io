"use client"

import { useId, useRef, useState } from "react"
import Image from "next/image"
import { Eye, ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type RequirementExampleImageFieldValue = {
  assetUrl: string
  fileName: string
}

type RequirementExampleImageFieldProps = {
  value: RequirementExampleImageFieldValue | null
  disabled?: boolean
  uploading?: boolean
  removing?: boolean
  onFileSelected: (file: File) => void
  onRemove: () => void
  className?: string
}

export function RequirementExampleImageField({
  value,
  disabled = false,
  uploading = false,
  removing = false,
  onFileSelected,
  onRemove,
  className,
}: RequirementExampleImageFieldProps) {
  const t = useTranslations("dashboard.vendor.requirementExampleImage")
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const busy = disabled || uploading || removing
  const copy = {
    label: t.has("label") ? t("label") : "Example image",
    description: t.has("description")
      ? t("description")
      : "Optional reference image shown to the client before they upload their own file.",
    emptyTitle: t.has("emptyTitle") ? t("emptyTitle") : "No example image",
    emptyDescription: t.has("emptyDescription")
      ? t("emptyDescription")
      : "Upload a photo example such as a car front, car back, or ID sample.",
    upload: t.has("upload") ? t("upload") : "Upload example",
    uploading: t.has("uploading") ? t("uploading") : "Uploading…",
    replace: t.has("replace") ? t("replace") : "Replace image",
    remove: t.has("remove") ? t("remove") : "Remove image",
    removing: t.has("removing") ? t("removing") : "Removing…",
    view: t.has("view") ? t("view") : "View example",
    currentImage: t.has("currentImage") ? t("currentImage") : "Current example image",
    visibleToClient: t.has("visibleToClient")
      ? t("visibleToClient")
      : "Clients will see this before they upload their own file.",
    previewTitle: t.has("previewTitle") ? t("previewTitle") : "Example image preview",
    previewDescription: t.has("previewDescription")
      ? t("previewDescription")
      : "This is the visual example the client will see during the upload step.",
    previewUnavailable: t.has("previewUnavailable")
      ? t("previewUnavailable")
      : "This example image is not available right now.",
  }

  function openFilePicker() {
    if (busy) {
      return
    }

    inputRef.current?.click()
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {copy.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>

        {value ? (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
            <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
              <Image
                src={value.assetUrl}
                alt={value.fileName || copy.label}
                fill
                sizes="(max-width: 768px) 100vw, 360px"
                className="object-cover"
              />
            </div>

            <div className="space-y-3 px-3 py-3">
              <div className="space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {value.fileName || copy.currentImage}
                </p>
                <p className="text-xs text-muted-foreground">
                  {copy.visibleToClient}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="size-3.5" />
                  {copy.view}
                </Button>

                <button
                  ref={uploadTriggerRef}
                  type="button"
                  onClick={openFilePicker}
                  disabled={busy}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 rounded-lg px-3 text-xs"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="size-3.5" />
                  )}
                  {uploading ? copy.uploading : copy.replace}
                </button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onRemove}
                  disabled={busy}
                >
                  {removing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {removing ? copy.removing : copy.remove}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            ref={uploadTriggerRef}
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center transition-colors hover:border-[var(--contrazy-teal)]/40 hover:bg-[var(--contrazy-teal)]/5 disabled:opacity-60"
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-muted-foreground ring-1 ring-slate-950/[0.05]">
              {uploading ? (
                <Loader2 className="size-4 animate-spin text-[var(--contrazy-teal)]" />
              ) : (
                <ImageIcon className="size-4" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{copy.emptyTitle}</p>
              <p className="text-xs text-muted-foreground">{copy.emptyDescription}</p>
            </div>
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 rounded-lg px-3 text-xs")}>
              {uploading ? copy.uploading : copy.upload}
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onChange={(event) => {
            const nextFile = event.target.files?.[0]

            if (nextFile) {
              onFileSelected(nextFile)
            }

            event.target.value = ""
            requestAnimationFrame(() => {
              uploadTriggerRef.current?.focus()
            })
          }}
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[720px] overflow-hidden rounded-2xl p-0">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-base font-semibold">
                {copy.previewTitle}
              </DialogTitle>
              <DialogDescription>
                {copy.previewDescription}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/70 bg-muted/20 p-4">
              {value ? (
                <Image
                  src={value.assetUrl}
                  alt={value.fileName || copy.previewTitle}
                  width={1200}
                  height={900}
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{copy.previewUnavailable}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
