"use client"

export type ContractTemplateDraftSnapshot = {
  version: number
  name: string
  description: string
  content: string
  selectionIndex: number | null
  sourceUpdatedAt: string | null
  persistedAt: string
}

export type ContractEditorRestoreState =
  | { status: "idle" }
  | { status: "available"; draft: ContractTemplateDraftSnapshot }

const CONTRACT_DRAFT_STORAGE_VERSION = 1
const CONTRACT_DRAFT_STORAGE_PREFIX = "conntrazy.contract-template-draft"

function getDraftStorageKey(key: string) {
  return `${CONTRACT_DRAFT_STORAGE_PREFIX}:${key}`
}

export function createDraftSnapshot(input: Omit<ContractTemplateDraftSnapshot, "version" | "persistedAt">) {
  return {
    version: CONTRACT_DRAFT_STORAGE_VERSION,
    persistedAt: new Date().toISOString(),
    ...input,
  } satisfies ContractTemplateDraftSnapshot
}

export function loadContractDraft(key: string): ContractTemplateDraftSnapshot | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(getDraftStorageKey(key))

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as ContractTemplateDraftSnapshot

    if (parsed.version !== CONTRACT_DRAFT_STORAGE_VERSION) {
      window.localStorage.removeItem(getDraftStorageKey(key))
      return null
    }

    return parsed
  } catch {
    window.localStorage.removeItem(getDraftStorageKey(key))
    return null
  }
}

export function saveContractDraft(key: string, snapshot: ContractTemplateDraftSnapshot) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(getDraftStorageKey(key), JSON.stringify(snapshot))
}

export function clearContractDraft(key: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(getDraftStorageKey(key))
}
