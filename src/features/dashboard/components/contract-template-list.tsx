"use client"

import { useState } from "react"
import type { ContractTemplate } from "@prisma/client"
import { FileText, Plus, Trash2, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const mergeFields = [
  { label: "Client name", token: "{{clientName}}" },
  { label: "Client email", token: "{{clientEmail}}" },
  { label: "Client phone", token: "{{clientPhone}}" },
  { label: "Client company", token: "{{clientCompany}}" },
  { label: "Business name", token: "{{vendorName}}" },
  { label: "Reference", token: "{{transactionReference}}" },
  { label: "Service amount", token: "{{paymentAmount}}" },
  { label: "Deposit amount", token: "{{depositAmount}}" },
] as const

function applyMergeFieldPreview(content: string) {
  return mergeFields.reduce((acc, field) => acc.replaceAll(field.token, `[${field.label}]`), content)
}

export function ContractTemplateList({ 
  initialTemplates,
  initialTotalCount,
  canEdit,
  blockedMessage,
  templateLimit,
  templateLimitMessage,
}: { 
  initialTemplates: ContractTemplate[]
  initialTotalCount: number
  canEdit: boolean
  blockedMessage: string
  templateLimit: number | null
  templateLimitMessage: string | null
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [templateCount, setTemplateCount] = useState(initialTotalCount)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Form State
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [content, setContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const hasReachedTemplateLimit = templateLimit !== null && templateCount >= templateLimit
  const canCreate = canEdit && !hasReachedTemplateLimit
  const createBlockedMessage = hasReachedTemplateLimit ? (templateLimitMessage ?? "Your current plan limit has been reached.") : null

  function openNewDialog() {
    if (!canCreate) {
      return
    }

    setName("")
    setDescription("")
    setContent("This agreement is entered into between {{vendorName}} and {{clientName}}.")
    setEditingId(null)
    setSaveError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(t: ContractTemplate) {
    if (!canEdit) {
      return
    }

    setName(t.name)
    setDescription(t.description || "")
    setContent(t.content)
    setEditingId(t.id)
    setSaveError(null)
    setIsDialogOpen(true)
  }

  function insertMergeField(token: string) {
    setContent((current) => `${current}${current ? " " : ""}${token}`)
  }

  async function handleSave() {
    if (!canEdit) {
      setSaveError(blockedMessage)
      return
    }

    if (!editingId && hasReachedTemplateLimit) {
      setSaveError(createBlockedMessage)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const url = editingId ? `/api/vendor/contracts/${editingId}` : '/api/vendor/contracts'
      const method = editingId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content })
      })
      
      const payload = await res.json().catch(() => null)

      if (res.ok) {
        const saved = payload
        if (editingId) {
          setTemplates((current) => current.map((template) => template.id === saved.id ? saved : template))
        } else {
          setTemplates((current) => [saved, ...current])
          setTemplateCount((current) => current + 1)
        }
        setIsDialogOpen(false)
        setSaveError(null)
        return
      }

      setSaveError(payload?.message ?? `Unable to ${editingId ? "update" : "create"} template right now`)
    } catch (e) {
      console.error(e)
      setSaveError(`Unable to ${editingId ? "update" : "create"} template right now`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm("Are you sure you want to delete this template?")) return
    
    try {
      const res = await fetch(`/api/vendor/contracts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates((current) => current.filter((template) => template.id !== id))
        setTemplateCount((current) => Math.max(current - 1, 0))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTitle>Editing unavailable</AlertTitle>
          <AlertDescription>{blockedMessage}</AlertDescription>
        </Alert>
      ) : null}
      {canEdit && hasReachedTemplateLimit && createBlockedMessage ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTitle>Template limit reached</AlertTitle>
          <AlertDescription>{createBlockedMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setSaveError(null)
            }
          }}
        >
          <Button onClick={openNewDialog} disabled={!canCreate} title={!canCreate ? createBlockedMessage ?? undefined : undefined}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
              <DialogDescription>
                Define the agreement text for your transactions and insert merge fields where customer or payment details should appear.
              </DialogDescription>
            </DialogHeader>
            {saveError ? (
              <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
                <AlertTitle>Unable to save template</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Standard Car Rental Agreement"
                  maxLength={INPUT_LIMITS.contractTemplateName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief note about when to use this"
                  maxLength={INPUT_LIMITS.contractTemplateDescription}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content">Contract Terms</Label>
                <Textarea 
                  id="content" 
                  className="min-h-[250px] text-sm"
                  value={content} 
                  maxLength={INPUT_LIMITS.contractContent}
                  onChange={e => setContent(e.target.value)} 
                />
                <CharacterCount current={content.length} limit={INPUT_LIMITS.contractContent} className="text-right" />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Insert the details you want filled automatically when the client opens the transaction.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mergeFields.map((field) => (
                      <Button
                        key={field.token}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertMergeField(field.token)}
                      >
                        {field.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !name || !content || (!editingId && !canCreate)}>
                {isSaving ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Create your first contract template to speed up transaction creation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <CardTitle className="line-clamp-1">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription className="line-clamp-1">{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                <p className="line-clamp-3 rounded border bg-muted/50 p-2 text-xs text-muted-foreground">
                  {applyMergeFieldPreview(template.content)}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(template)} disabled={!canEdit}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id)} disabled={!canEdit}>
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
