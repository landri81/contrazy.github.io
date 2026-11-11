import type { ChecklistItem, ChecklistTemplate } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { normalizeRequirementFileSlotLabels } from "@/features/transactions/contract-flow"

/**
 * The vendor's checklists (Settings › Checklists) for a partner (LOCAZ, 11 Nov 2026): what each asks, in order, with
 * the example image the vendor chose. A partner shows them on its own pages (its document step, its vehicle
 * inspection) and sends the items it uses back as booking `requirements`, example image included, so the vendor edits
 * once in Contrazy.
 */

export type PartnerChecklistItem = {
  id: string
  label: string
  description: string | null
  type: ChecklistItem["type"]
  category: ChecklistItem["category"]
  customCategoryLabel: string | null
  required: boolean
  fileCount: number
  /** One label per file, as the customer sees them (the item's label when the vendor named none). */
  slotLabels: string[]
  /** A public image; `publicId` and `fileName` go back unchanged in a booking requirement. */
  exampleImage: { url: string; publicId: string | null; fileName: string | null } | null
}

export type PartnerChecklist = { id: string; name: string; description: string | null; updatedAt: string; items: PartnerChecklistItem[] }

export function presentPartnerChecklist(checklist: ChecklistTemplate & { items: ChecklistItem[] }): PartnerChecklist {
  return {
    id: checklist.id,
    name: checklist.name,
    description: checklist.description,
    updatedAt: checklist.updatedAt.toISOString(),
    items: [...checklist.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        type: item.type,
        category: item.category,
        customCategoryLabel: item.customCategoryLabel,
        required: item.required,
        fileCount: item.requiredFileCount,
        slotLabels: normalizeRequirementFileSlotLabels({ type: item.type, fileCount: item.requiredFileCount, labels: item.fileSlotLabels, requirementLabel: item.label }),
        exampleImage: item.exampleImageUrl ? { url: item.exampleImageUrl, publicId: item.exampleImagePublicId, fileName: item.exampleImageFileName } : null,
      })),
  }
}

export async function listPartnerChecklists(vendorId: string): Promise<PartnerChecklist[]> {
  const rows = await prisma.checklistTemplate.findMany({ where: { vendorId }, include: { items: true }, orderBy: { createdAt: "asc" } })
  return rows.map(presentPartnerChecklist)
}
