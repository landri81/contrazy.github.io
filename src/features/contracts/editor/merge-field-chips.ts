"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import type { Editor } from "@tiptap/react"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"
import { contractMergeFields } from "@/features/contracts/template-authoring"

const mergeFieldLabelLookup = new Map(
  contractMergeFields.map((field) => [field.token, field.label])
)

export function getMergeFieldLabel(token: string): string {
  return mergeFieldLabelLookup.get(token) ?? token.replace(/[{}]/g, "")
}

// TipTap inline atom node that renders {{token}} as a styled chip
export const MergeFieldExtension = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-token"),
        renderHTML: (attrs) => ({ "data-token": attrs.token }),
      },
      label: {
        default: null,
        parseHTML: (element) => {
          const el = element as HTMLElement
          return el.getAttribute("data-label") ?? el.textContent?.trim() ?? null
        },
        renderHTML: (attrs) => (attrs.label ? { "data-label": attrs.label } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-token]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "contract-merge-chip",
        contenteditable: "false",
      }),
      String(node.attrs.label ?? node.attrs.token ?? ""),
    ]
  },

  renderText({ node }) {
    return String(node.attrs.token ?? "")
  },
})

// Convert stored HTML (with raw {{token}} text) → editor HTML (with <span data-token> chips)
export function templateMarkupToEditorHtml(content: string): string {
  const normalized = normalizeContractTemplateMarkup(content)
  return normalized.replace(/\{\{([^}]+)\}\}/g, (match) => {
    const label = getMergeFieldLabel(match)
    return `<span data-token="${match}" data-label="${label}">${label}</span>`
  })
}

// Convert editor HTML (with <span data-token> chips) → stored HTML (with {{token}} text)
export function editorHtmlToTemplateMarkup(html: string): string {
  if (typeof document === "undefined") return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html")
  const root = doc.getElementById("root")
  if (!root) return html

  root.querySelectorAll<HTMLElement>("span[data-token]").forEach((chip) => {
    const token = chip.dataset.token
    if (token) chip.replaceWith(doc.createTextNode(token))
  })

  // Handle any legacy chip markup
  root.querySelectorAll<HTMLElement>("span.contract-merge-chip").forEach((chip) => {
    const token = chip.dataset.token
    if (token) chip.replaceWith(doc.createTextNode(token))
  })

  return root.innerHTML
}

const TIPTAP_EMPTY = new Set(["", "<p></p>", "<p><br></p>", "<p><br/></p>"])

export function getEditorMarkup(html: string): string {
  if (TIPTAP_EMPTY.has(html.trim())) return ""
  return editorHtmlToTemplateMarkup(html)
}

export function insertMergeFieldInEditor(editor: Editor, token: string): void {
  const label = getMergeFieldLabel(token)
  editor.chain().focus().insertContent({ type: "mergeField", attrs: { token, label } }).run()
}

// Legacy no-op stubs — kept so no other import sites break
export function ensureContractMergeFieldBlot(_QuillClass: unknown): void {}
export function attachContractMergeFieldMatcher(_quill: unknown, _QuillClass: unknown): void {}
export function insertMergeFieldChip(_quill: unknown, _token: string, _selection: unknown): void {}
export function resolveMergeFieldLabel(token: string): string {
  return getMergeFieldLabel(token)
}
