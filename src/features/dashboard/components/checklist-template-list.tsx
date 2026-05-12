"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import type { ChecklistTemplate, ChecklistItem } from "@prisma/client"
import {
  FileText,
  GripVertical,
  Image as ImageIcon,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { RequirementExampleImageField } from "@/features/dashboard/components/requirement-example-image-field"
import {
  cleanupVendorRequirementExampleImages,
  uploadVendorRequirementExampleImage,
  VendorRequirementExampleUploadError,
} from "@/features/dashboard/lib/vendor-requirement-example-upload-client"
import {
  type RequirementExampleCleanupAsset,
  type RequirementExampleDraft,
  toRequirementExampleCleanupAsset,
} from "@/features/dashboard/lib/vendor-requirement-example-images"
import { requirementCategoryOptions } from "@/features/transactions/contract-flow"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type FullChecklist = ChecklistTemplate & { items: ChecklistItem[] }

type DraftItem = {
  label: string
  description: string
  type: string
  category: string
  customCategoryLabel: string
  required: boolean
  exampleImage: RequirementExampleDraft | null
}

function buildDraftItem(item?: Partial<ChecklistItem>): DraftItem {
  const exampleImage =
    item?.exampleImageUrl && item.exampleImagePublicId
      ? {
          source: "saved" as const,
          assetUrl: item.exampleImageUrl,
          publicId: item.exampleImagePublicId,
          fileName: item.exampleImageFileName ?? item.label ?? "Example image",
        }
      : null

  return {
    label: item?.label ?? "",
    description: item?.description ?? "",
    type: item?.type ?? "DOCUMENT",
    category: item?.category ?? "CUSTOM",
    customCategoryLabel: item?.customCategoryLabel ?? "",
    required: item?.required ?? true,
    exampleImage,
  }
}

function getLocalAssets(items: DraftItem[]) {
  return items.flatMap((item) =>
    item.exampleImage?.source === "local"
      ? [toRequirementExampleCleanupAsset(item.exampleImage)]
      : []
  )
}

export function ChecklistTemplateList({
  initialTemplates,
  canEdit,
  blockedMessage,
}: {
  initialTemplates: FullChecklist[]
  canEdit: boolean
  blockedMessage: string
}) {
  const t = useTranslations("dashboard.vendor.checklistEditor")
  const exampleT = useTranslations("dashboard.vendor.requirementExampleImage")
  const exampleCopy = {
    badge: exampleT.has("badge") ? exampleT("badge") : "Example",
    errorTitle: exampleT.has("errorTitle") ? exampleT("errorTitle") : "Example image error",
    invalidType: exampleT.has("errors.invalidType")
      ? exampleT("errors.invalidType")
      : "Only image files are allowed for requirement examples.",
    fileTooLarge: exampleT.has("errors.fileTooLarge")
      ? exampleT("errors.fileTooLarge")
      : "Example images must be 10 MB or smaller.",
    signingFailed: exampleT.has("errors.signingFailed")
      ? exampleT("errors.signingFailed")
      : "Upload signing is unavailable right now. Please try again.",
    uploadFailed: exampleT.has("errors.uploadFailed")
      ? exampleT("errors.uploadFailed")
      : "The example image could not be uploaded. Please try again.",
    unexpected: exampleT.has("errors.unexpected")
      ? exampleT("errors.unexpected")
      : "An unexpected error occurred while preparing the example image.",
  }

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

  function mapExampleError(error: unknown) {
    if (!(error instanceof VendorRequirementExampleUploadError)) {
      return exampleCopy.unexpected
    }

    switch (error.code) {
      case "INVALID_TYPE":
        return exampleCopy.invalidType
      case "FILE_TOO_LARGE":
        return exampleCopy.fileTooLarge
      case "SIGNING_FAILED":
        return exampleCopy.signingFailed
      case "UPLOAD_FAILED":
      default:
        return error.message || exampleCopy.uploadFailed
    }
  }

  const [templates, setTemplates] = useState(initialTemplates)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [items, setItems] = useState<DraftItem[]>([])
  const [uploadingByIndex, setUploadingByIndex] = useState<Record<number, boolean>>({})
  const [removingByIndex, setRemovingByIndex] = useState<Record<number, boolean>>({})
  const pendingLocalAssetsRef = useRef<RequirementExampleCleanupAsset[]>([])
  const skipPendingCleanupRef = useRef(false)

  useEffect(() => {
    setTemplates(initialTemplates)
  }, [initialTemplates])

  useEffect(() => {
    pendingLocalAssetsRef.current = getLocalAssets(items)
  }, [items])

  useEffect(() => {
    return () => {
      if (skipPendingCleanupRef.current || pendingLocalAssetsRef.current.length === 0) {
        return
      }

      void cleanupVendorRequirementExampleImages(pendingLocalAssetsRef.current, {
        keepalive: true,
      })
    }
  }, [])

  const dialogTitle = editingTemplateId ? t("editTitle") : t("createTitle")
  const dialogDescription = editingTemplateId ? t("editDescription") : t("createDescription")

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [templates]
  )

  function resetDialogState() {
    setEditingTemplateId(null)
    setName("")
    setDescription("")
    setItems([])
    setUploadingByIndex({})
    setRemovingByIndex({})
    setFormError(null)
  }

  async function cleanupCurrentLocalAssets(options?: { keepalive?: boolean }) {
    const assets = getLocalAssets(items)

    if (assets.length === 0) {
      return
    }

    await cleanupVendorRequirementExampleImages(assets, options)
  }

  async function closeDialog(discardLocalUploads: boolean) {
    if (discardLocalUploads && !skipPendingCleanupRef.current) {
      await cleanupCurrentLocalAssets()
    }

    skipPendingCleanupRef.current = false
    pendingLocalAssetsRef.current = []
    setIsDialogOpen(false)
    resetDialogState()
  }

  function openNewDialog() {
    skipPendingCleanupRef.current = false
    setEditingTemplateId(null)
    setName("")
    setDescription("")
    setItems([
      {
        ...buildDraftItem(),
        label: t("defaultItemLabel"),
        description: t("defaultItemDesc"),
        type: "PHOTO",
        category: "ID",
      },
    ])
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(template: FullChecklist) {
    skipPendingCleanupRef.current = false
    setEditingTemplateId(template.id)
    setName(template.name)
    setDescription(template.description ?? "")
    setItems(template.items.map((item) => buildDraftItem(item)))
    setFormError(null)
    setIsDialogOpen(true)
  }

  function addItem() {
    setItems((current) => [...current, buildDraftItem()])
  }

  function updateItem(index: number, field: keyof DraftItem, value: string | boolean) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        if (field === "type" && value === "TEXT") {
          return {
            ...item,
            type: "TEXT",
            exampleImage: null,
          }
        }

        if (field === "category") {
          return {
            ...item,
            category: value as string,
            customCategoryLabel: value === "OTHER" ? item.customCategoryLabel : "",
          }
        }

        return { ...item, [field]: value }
      })
    )
  }

  async function handleExampleUpload(index: number, file: File) {
    const previousImage = items[index]?.exampleImage

    setFormError(null)
    setUploadingByIndex((current) => ({ ...current, [index]: true }))

    try {
      const uploaded = await uploadVendorRequirementExampleImage(file)

      setItems((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                exampleImage: {
                  source: "local",
                  ...uploaded,
                },
              }
            : item
        )
      )

      if (previousImage?.source === "local" && previousImage.publicId !== uploaded.publicId) {
        void cleanupVendorRequirementExampleImages([toRequirementExampleCleanupAsset(previousImage)])
      }
    } catch (error) {
      toast({
        variant: "error",
        title: exampleCopy.errorTitle,
        description: mapExampleError(error),
      })
    } finally {
      setUploadingByIndex((current) => ({ ...current, [index]: false }))
    }
  }

  async function handleExampleRemove(index: number) {
    const currentImage = items[index]?.exampleImage

    if (!currentImage) {
      return
    }

    setRemovingByIndex((current) => ({ ...current, [index]: true }))
    setFormError(null)

    try {
      setItems((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                exampleImage: null,
              }
            : item
        )
      )

      if (currentImage.source === "local") {
        await cleanupVendorRequirementExampleImages([toRequirementExampleCleanupAsset(currentImage)])
      }
    } finally {
      setRemovingByIndex((current) => ({ ...current, [index]: false }))
    }
  }

  async function handleTypeChange(index: number, nextType: string) {
    const currentImage = items[index]?.exampleImage

    updateItem(index, "type", nextType)

    if (nextType === "TEXT" && currentImage?.source === "local") {
      await cleanupVendorRequirementExampleImages([toRequirementExampleCleanupAsset(currentImage)])
    }
  }

  async function removeItem(index: number) {
    const currentImage = items[index]?.exampleImage

    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))

    if (currentImage?.source === "local") {
      await cleanupVendorRequirementExampleImages([toRequirementExampleCleanupAsset(currentImage)])
    }
  }

  async function handleSave() {
    if (!canEdit) {
      return
    }

    setFormError(null)
    setIsSaving(true)

    try {
      const payload = {
        name,
        description,
        items: items.map((item) => ({
          label: item.label,
          description: item.description || null,
          type: item.type,
          category: item.category,
          customCategoryLabel: item.category === "OTHER" ? item.customCategoryLabel || null : null,
          required: item.required,
          exampleImageUrl: item.type === "TEXT" ? null : item.exampleImage?.assetUrl ?? null,
          exampleImagePublicId: item.type === "TEXT" ? null : item.exampleImage?.publicId ?? null,
          exampleImageFileName: item.type === "TEXT" ? null : item.exampleImage?.fileName ?? null,
        })),
      }

      const response = await fetch(
        editingTemplateId ? `/api/vendor/checklists/${editingTemplateId}` : "/api/vendor/checklists",
        {
          method: editingTemplateId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setFormError(result?.message ?? t("saveFailed"))
        return
      }

      const savedTemplate = (await response.json()) as FullChecklist

      skipPendingCleanupRef.current = true
      setTemplates((current) => {
        if (editingTemplateId) {
          return current.map((template) =>
            template.id === editingTemplateId ? savedTemplate : template
          )
        }

        return [savedTemplate, ...current]
      })
      await closeDialog(false)
    } catch (error) {
      console.error(error)
      setFormError(t("saveFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit || !confirm(t("confirmDelete"))) {
      return
    }

    try {
      const response = await fetch(`/api/vendor/checklists/${id}`, { method: "DELETE" })

      if (response.ok) {
        setTemplates((current) => current.filter((template) => template.id !== id))
        return
      }

      const result = await response.json().catch(() => null)
      toast({
        variant: "error",
        title: t("deleteFailedTitle"),
        description: result?.message ?? t("deleteFailed"),
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "error",
        title: t("deleteFailedTitle"),
        description: t("deleteFailed"),
      })
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTitle>{t("editingUnavailable")}</AlertTitle>
          <AlertDescription>{blockedMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              void closeDialog(true)
              return
            }

            setIsDialogOpen(true)
          }}
        >
          <Button onClick={openNewDialog} disabled={!canEdit}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newChecklist")}
          </Button>

          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[860px]">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("labelName")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  maxLength={INPUT_LIMITS.checklistName}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">{t("labelDescription")}</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  maxLength={INPUT_LIMITS.checklistDescription}
                />
              </div>

              <div className="mt-4">
                <Label className="text-base">{t("requirementsLabel")}</Label>
                <div className="mt-3 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${index}-${item.type}`} className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                      <GripVertical className="mt-2 h-5 w-5 cursor-move text-muted-foreground opacity-50" />

                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-1">
                            <Label className="text-xs">{t("labelLabel")}</Label>
                            <Input
                              value={item.label}
                              onChange={(event) => updateItem(index, "label", event.target.value)}
                              placeholder={t("itemLabelPlaceholder")}
                              maxLength={INPUT_LIMITS.checklistItemLabel}
                            />
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">{t("labelType")}</Label>
                            <Select
                              value={item.type}
                              onValueChange={(value) => {
                                if (value) {
                                  void handleTypeChange(index, value)
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DOCUMENT">{t("typeDocument")}</SelectItem>
                                <SelectItem value="PHOTO">{t("typePhoto")}</SelectItem>
                                <SelectItem value="TEXT">{t("typeText")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-1">
                            <Label className="text-xs">{t("labelCategory")}</Label>
                            <Select
                              value={item.category}
                              onValueChange={(value) => {
                                if (value) {
                                  updateItem(index, "category", value)
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {requirementCategoryOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {reqCategoryLabels[option.value] ?? option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">{t("labelOther")}</Label>
                            <Input
                              value={item.customCategoryLabel}
                              onChange={(event) => updateItem(index, "customCategoryLabel", event.target.value)}
                              placeholder={t("otherPlaceholder")}
                              maxLength={INPUT_LIMITS.checklistItemLabel}
                              disabled={item.category !== "OTHER"}
                            />
                          </div>
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-xs">{t("labelInstructions")}</Label>
                          <Input
                            value={item.description}
                            onChange={(event) => updateItem(index, "description", event.target.value)}
                            placeholder={t("instructionsPlaceholder")}
                            maxLength={INPUT_LIMITS.checklistItemInstructions}
                          />
                          <CharacterCount
                            current={item.description.length}
                            limit={INPUT_LIMITS.checklistItemInstructions}
                            className="text-right"
                          />
                        </div>

                        {item.type !== "TEXT" ? (
                          <RequirementExampleImageField
                            value={
                              item.exampleImage
                                ? {
                                    assetUrl: item.exampleImage.assetUrl,
                                    fileName: item.exampleImage.fileName,
                                  }
                                : null
                            }
                            uploading={Boolean(uploadingByIndex[index])}
                            removing={Boolean(removingByIndex[index])}
                            disabled={isSaving}
                            onFileSelected={(file) => void handleExampleUpload(index, file)}
                            onRemove={() => void handleExampleRemove(index)}
                          />
                        ) : null}

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`req-${index}`}
                            checked={item.required}
                            onCheckedChange={(checked) => updateItem(index, "required", Boolean(checked))}
                          />
                          <Label htmlFor={`req-${index}`} className="text-xs font-normal">
                            {t("required")}
                          </Label>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void removeItem(index)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={!canEdit || isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={addItem} className="mt-3 w-full" disabled={!canEdit || isSaving}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addRequirement")}
                </Button>
              </div>

              {formError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => void closeDialog(true)} disabled={isSaving}>
                {t("cancelBtn")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !canEdit ||
                  isSaving ||
                  !name.trim() ||
                  items.length === 0 ||
                  items.some(
                    (item) =>
                      !item.label.trim() ||
                      (item.category === "OTHER" && !item.customCategoryLabel.trim())
                  )
                }
              >
                {isSaving ? t("saving") : editingTemplateId ? t("saveChanges") : t("saveChecklist")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sortedTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t("empty")}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <CardTitle className="line-clamp-1 flex items-center justify-between">
                  {template.name}
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs font-normal text-muted-foreground">
                    {template.items.length} {t("items")}
                  </span>
                </CardTitle>
                {template.description ? (
                  <CardDescription className="line-clamp-1">{template.description}</CardDescription>
                ) : null}
              </CardHeader>

              <CardContent className="pb-3">
                <ul className="space-y-2 text-sm">
                  {template.items.slice(0, 3).map((item, index) => (
                    <li key={`${template.id}-${index}`} className="flex items-center gap-2 text-muted-foreground">
                      {item.type === "PHOTO" ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate">{item.label}</span>
                      <span className="rounded-full border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                        {translatedCategoryLabel(item.category, item.customCategoryLabel)}
                      </span>
                      {item.exampleImageUrl ? (
                        <span className="rounded-full border border-[var(--contrazy-teal)]/20 bg-[var(--contrazy-teal)]/8 px-1.5 py-0.5 text-[10px] font-medium text-[var(--contrazy-teal)]">
                          {exampleCopy.badge}
                        </span>
                      ) : null}
                      {item.required ? <span className="text-xs text-destructive">*</span> : null}
                    </li>
                  ))}
                  {template.items.length > 3 ? (
                    <li className="pl-5 text-xs italic text-muted-foreground">
                      {t("moreItems", { count: template.items.length - 3 })}
                    </li>
                  ) : null}
                </ul>
              </CardContent>

              <CardFooter className="flex justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {t("updatedAt", { date: new Date(template.updatedAt).toLocaleDateString() })}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditDialog(template)}
                    disabled={!canEdit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void handleDelete(template.id)}
                    disabled={!canEdit}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
