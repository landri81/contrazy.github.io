"use client"

import JSZip from "jszip"
import Image from "next/image"
import { useState } from "react"
import { Camera, Download, FileText, Loader2, Paperclip } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"

type RequirementRow = {
  id: string
  label: string
  type: string
  required: boolean
  instructions: string | null
  requiredFileCount: number | null
}

type DocumentRow = {
  id: string
  requirementId: string | null
  assetUrl: string | null
  fileName: string | null
  publicId: string | null
  textValue: string | null
  slotIndex: number
  slotLabel: string | null
  source: string
}

function isPdf(fileName: string | null, assetUrl: string | null) {
  const name = (fileName ?? assetUrl ?? "").toLowerCase()
  return name.endsWith(".pdf") || name.includes("/raw/upload/")
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

function fileExt(fileName: string | null, assetUrl: string | null): string {
  const name = fileName ?? assetUrl ?? ""
  const dot = name.lastIndexOf(".")
  if (dot !== -1) {
    const ext = name.slice(dot + 1).split("?")[0].toLowerCase()
    if (ext.length <= 5) return ext
  }
  return "jpg"
}

export function TransactionRequirementsCard({
  requirements,
  documents,
  transactionTitle,
}: {
  requirements: RequirementRow[]
  documents: DocumentRow[]
  transactionTitle: string
}) {
  const t = useTranslations("dashboard.vendor.transactionDetailPage")
  const [downloading, setDownloading] = useState(false)

  const docsByRequirement = new Map<string, DocumentRow[]>()
  for (const req of requirements) {
    docsByRequirement.set(
      req.id,
      documents
        .filter((d) => d.requirementId === req.id)
        .sort((a, b) => a.slotIndex - b.slotIndex)
    )
  }

  const imageDocs = documents.filter(
    (d) => d.requirementId && d.assetUrl && !d.textValue && !isPdf(d.fileName, d.assetUrl)
  )

  async function handleDownloadAll() {
    if (imageDocs.length === 0) return
    setDownloading(true)
    try {
      const zip = new JSZip()
      const txSlug = slugify(transactionTitle) || "transaction"

      await Promise.all(
        imageDocs.map(async (doc) => {
          const req = requirements.find((r) => r.id === doc.requirementId)
          const reqSlug = slugify(req?.label ?? "file")
          const slotSlug = doc.slotLabel ? slugify(doc.slotLabel) : `${doc.slotIndex + 1}`
          const ext = fileExt(doc.fileName, doc.assetUrl)
          const zipName = `${reqSlug}_${slotSlug}.${ext}`

          try {
            const res = await fetch(doc.assetUrl!)
            const blob = await res.blob()
            zip.file(zipName, blob)
          } catch {
            // skip unreachable files silently
          }
        })
      )

      const content = await zip.generateAsync({ type: "blob" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(content)
      a.download = `${txSlug}_documents.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("requirementsTitle")}</CardTitle>
            <CardDescription className="mt-1">{t("requirementsDescription")}</CardDescription>
          </div>
          {imageDocs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={downloading}
              onClick={handleDownloadAll}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {downloading ? t("downloading") : t("downloadAllPictures")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {requirements.map((requirement) => {
          const slots = docsByRequirement.get(requirement.id) ?? []
          const hasResponse = slots.length > 0

          return (
            <div key={requirement.id} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {requirement.type === "CAPTURE"
                      ? t("liveCapture")
                      : requirement.type}
                    {" · "}
                    {requirement.required ? t("required") : t("optional")}
                  </p>
                  {requirement.instructions ? (
                    <p className="mt-2 text-sm text-muted-foreground">{requirement.instructions}</p>
                  ) : null}
                </div>
                <StatusBadge tone={hasResponse ? "success" : "warning"}>
                  {hasResponse ? t("submitted") : t("pending")}
                </StatusBadge>
              </div>

              {slots.length > 0 && (
                <div className="mt-4">
                  {/* Text requirement */}
                  {requirement.type === "TEXT" ? (
                    <div className="rounded-md border bg-white p-3 text-sm text-foreground">
                      {slots[0]?.textValue}
                    </div>
                  ) : (
                    /* File / image grid */
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {slots.map((doc) => {
                        const isDocPdf = isPdf(doc.fileName, doc.assetUrl)
                        const slotLabel = doc.slotLabel ?? `#${doc.slotIndex + 1}`
                        const isLiveCapture = doc.source === "LIVE_CAPTURE"

                        return (
                          <div
                            key={doc.id}
                            className="group relative overflow-hidden rounded-lg border bg-white"
                          >
                            {isDocPdf ? (
                              <div className="flex h-28 items-center justify-center bg-slate-50">
                                <FileText className="size-8 text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                                <Image
                                  src={doc.assetUrl!}
                                  alt={slotLabel}
                                  fill
                                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  unoptimized
                                />
                              </div>
                            )}

                            <div className="p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isLiveCapture ? (
                                    <Camera className="size-3 shrink-0 text-emerald-600" />
                                  ) : (
                                    <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="text-xs font-medium truncate text-foreground">
                                    {slotLabel}
                                  </span>
                                </div>
                                <a
                                  href={doc.assetUrl!}
                                  download={doc.fileName ?? undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  title={t("downloadUploadedFile")}
                                >
                                  <Download className="size-3.5" />
                                </a>
                              </div>
                              {doc.fileName && (
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                  {doc.fileName}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
