"use client"

import { useState } from "react"
import type { ChecklistTemplate, ChecklistItem } from "@prisma/client"
import { ListChecks, Plus, Trash2, GripVertical, Image as ImageIcon, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type FullChecklist = ChecklistTemplate & { items: ChecklistItem[] }

export function ChecklistTemplateList({ 
  initialTemplates,
  vendorId
}: { 
  initialTemplates: FullChecklist[]
  vendorId: string
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form State
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [items, setItems] = useState<{ label: string, description: string, type: string, required: boolean }[]>([])

  function openNewDialog() {
    setName("")
    setDescription("")
    setItems([{ label: "ID Card", description: "Front and back", type: "PHOTO", required: true }])
    setIsDialogOpen(true)
  }

  function addItem() {
    setItems([...items, { label: "", description: "", type: "DOCUMENT", required: true }])
  }

  function updateItem(index: number, field: string, value: string | boolean) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/vendor/checklists', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, items })
      })
      
      if (res.ok) {
        const saved = await res.json()
        setTemplates([saved, ...templates])
        setIsDialogOpen(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this checklist template?")) return
    
    try {
      const res = await fetch(`/api/vendor/checklists/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates(templates.filter(t => t.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Requirement Checklist</DialogTitle>
              <DialogDescription>
                Define the documents and photos clients must provide.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Checklist Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Car Rental Requirements" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="When to use this checklist" />
              </div>

              <div className="mt-4">
                <Label className="text-base">Requirements</Label>
                <div className="space-y-3 mt-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move opacity-50" />
                      <div className="flex-1 grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1">
                            <Label className="text-xs">Label</Label>
                            <Input value={item.label} onChange={e => updateItem(index, 'label', e.target.value)} placeholder="e.g. Driver's License" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs">Type</Label>
                            <Select value={item.type} onValueChange={v => updateItem(index, 'type', v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DOCUMENT">Document (PDF/Image)</SelectItem>
                                <SelectItem value="PHOTO">Photo</SelectItem>
                                <SelectItem value="TEXT">Text Input</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Description / Instructions</Label>
                          <Input value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="e.g. Please upload both sides" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id={`req-${index}`} checked={item.required} onCheckedChange={c => updateItem(index, 'required', c)} />
                          <Label htmlFor={`req-${index}`} className="text-xs font-normal">Required field</Label>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addItem} className="mt-3 w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Requirement
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !name || items.length === 0 || items.some(i => !i.label)}>
                {isSaving ? "Saving..." : "Save Checklist"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No checklists yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Create a checklist to standardize the documents and photos you collect from clients.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <CardTitle className="line-clamp-1 flex items-center justify-between">
                  {template.name}
                  <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                    {template.items.length} items
                  </span>
                </CardTitle>
                {template.description && (
                  <CardDescription className="line-clamp-1">{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                <ul className="space-y-2 text-sm">
                  {template.items.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-muted-foreground">
                      {item.type === 'PHOTO' ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate">{item.label}</span>
                      {item.required && <span className="text-destructive text-xs">*</span>}
                    </li>
                  ))}
                  {template.items.length > 3 && (
                    <li className="text-xs text-muted-foreground italic pl-5">
                      + {template.items.length - 3} more
                    </li>
                  )}
                </ul>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id)}>
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
