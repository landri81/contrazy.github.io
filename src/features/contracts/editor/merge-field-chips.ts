"use client"

import { normalizeContractTemplateMarkup } from "@/features/contracts/contract-content"
import { contractMergeFields } from "@/features/contracts/template-authoring"

export type MergeFieldChipValue = {
  token: string
  label: string
}

type QuillInstance = import("quill").default
type QuillConstructor = typeof import("quill").default
type EmbedBlotConstructor = {
  new (...args: never[]): object
  create(value?: unknown): HTMLElement
}

const CHIP_BLOT_NAME = "contractMergeField"
const CHIP_CLASS_NAME = "contract-merge-chip"
const CHIP_SELECTOR = `span.${CHIP_CLASS_NAME}`

const mergeFieldLabelLookup = new Map(
  contractMergeFields.map((field) => [field.token, field.label])
)

const mergeFieldTokenPattern = new RegExp(
  `(${contractMergeFields.map((field) => escapeRegExp(field.token)).join("|")})`,
  "g"
)

let blotRegistered = false

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getMergeFieldLabel(token: string) {
  return mergeFieldLabelLookup.get(token) ?? token.replace(/[{}]/g, "")
}

function createChipMarkup(token: string) {
  const label = getMergeFieldLabel(token)

  return `<span class="${CHIP_CLASS_NAME}" data-token="${escapeHtmlAttribute(token)}" data-label="${escapeHtmlAttribute(label)}" contenteditable="false">${escapeHtml(label)}</span>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value)
}

function collectTextNodes(root: HTMLElement) {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let current = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      textNodes.push(current as Text)
    }

    current = walker.nextNode()
  }

  return textNodes
}

export function templateMarkupToEditorHtml(content: string) {
  const normalized = normalizeContractTemplateMarkup(content)
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="contract-editor-root">${normalized}</div>`, "text/html")
  const root = doc.getElementById("contract-editor-root")

  if (!root) {
    return normalized
  }

  const textNodes = collectTextNodes(root)

  for (const textNode of textNodes) {
    const original = textNode.nodeValue ?? ""

    mergeFieldTokenPattern.lastIndex = 0

    if (!mergeFieldTokenPattern.test(original)) {
      continue
    }

    mergeFieldTokenPattern.lastIndex = 0

    const fragment = doc.createDocumentFragment()
    let lastIndex = 0

    for (const match of original.matchAll(mergeFieldTokenPattern)) {
      const token = match[0]
      const matchIndex = match.index ?? 0

      if (matchIndex > lastIndex) {
        fragment.appendChild(doc.createTextNode(original.slice(lastIndex, matchIndex)))
      }

      const chipContainer = doc.createElement("div")
      chipContainer.innerHTML = createChipMarkup(token)
      fragment.appendChild(chipContainer.firstChild!)
      lastIndex = matchIndex + token.length
    }

    if (lastIndex < original.length) {
      fragment.appendChild(doc.createTextNode(original.slice(lastIndex)))
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return root.innerHTML
}

export function editorHtmlToTemplateMarkup(html: string) {
  const normalized = normalizeContractTemplateMarkup(html)
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="contract-editor-root">${normalized}</div>`, "text/html")
  const root = doc.getElementById("contract-editor-root")

  if (!root) {
    return normalized
  }

  root.querySelectorAll<HTMLElement>(CHIP_SELECTOR).forEach((chip) => {
    const token = chip.dataset.token ?? ""
    chip.replaceWith(doc.createTextNode(token))
  })

  return normalizeContractTemplateMarkup(root.innerHTML)
}

function isEmptyDelta(quill: QuillInstance) {
  const delta = quill.getContents()

  return (
    delta.ops.length === 1 &&
    typeof delta.ops[0]?.insert === "string" &&
    delta.ops[0].insert === "\n"
  )
}

export function getEditorMarkup(quill: QuillInstance) {
  if (isEmptyDelta(quill)) {
    return ""
  }

  return editorHtmlToTemplateMarkup(quill.root.innerHTML)
}

export function ensureContractMergeFieldBlot(QuillClass: QuillConstructor) {
  if (blotRegistered) {
    return
  }

  const Embed = QuillClass.import("blots/embed") as EmbedBlotConstructor

  class ContractMergeFieldBlot extends Embed {
    static blotName = CHIP_BLOT_NAME
    static tagName = "span"
    static className = CHIP_CLASS_NAME

    static create(value: MergeFieldChipValue) {
      const node = super.create() as HTMLElement
      const token = value?.token ?? ""
      const label = value?.label ?? getMergeFieldLabel(token)

      node.setAttribute("contenteditable", "false")
      node.dataset.token = token
      node.dataset.label = label
      node.textContent = label

      return node
    }

    static value(node: HTMLElement): MergeFieldChipValue {
      const token = node.dataset.token ?? ""
      const label = node.dataset.label ?? getMergeFieldLabel(token)

      return { token, label }
    }
  }

  QuillClass.register("formats/contractMergeField", ContractMergeFieldBlot, true)
  blotRegistered = true
}

export function attachContractMergeFieldMatcher(quill: QuillInstance, QuillClass: QuillConstructor) {
  const Delta = QuillClass.import("delta")

  quill.clipboard.addMatcher(CHIP_SELECTOR, (node) => {
    const element = node as HTMLElement
    const token = element.dataset.token ?? ""
    const label = element.dataset.label ?? getMergeFieldLabel(token)

    return new Delta().insert({
      [CHIP_BLOT_NAME]: { token, label },
    })
  })
}

export function insertMergeFieldChip(
  quill: QuillInstance,
  token: string,
  selection: { index: number; length: number }
) {
  const label = getMergeFieldLabel(token)

  if (selection.length > 0) {
    quill.deleteText(selection.index, selection.length, "user")
  }

  quill.insertEmbed(selection.index, CHIP_BLOT_NAME, { token, label }, "user")
  quill.setSelection(selection.index + 1, 0, "silent")
}

export function resolveMergeFieldLabel(token: string) {
  return getMergeFieldLabel(token)
}
