export type PaginationInput = {
  page?: string | number | null
  pageSize?: string | number | null
}

export type PaginationState = {
  page: number
  pageSize: number
  skip: number
}

export type PaginationMeta = {
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

function toInteger(value: string | number | null | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.trunc(parsed)
}

export function resolvePagination(
  input: PaginationInput,
  options: {
    defaultPage?: number
    defaultPageSize?: number
    maxPageSize?: number
  } = {}
): PaginationState {
  const defaultPage = options.defaultPage ?? 1
  const defaultPageSize = options.defaultPageSize ?? 20
  const maxPageSize = options.maxPageSize ?? 100

  const page = Math.max(1, toInteger(input.page, defaultPage))
  const requestedPageSize = Math.max(1, toInteger(input.pageSize, defaultPageSize))
  const pageSize = Math.min(maxPageSize, requestedPageSize)

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  }
}

export function buildPaginationMeta(totalCount: number, page: number, pageSize: number): PaginationMeta {
  return {
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  }
}

export function compactSearchParams(
  values: Record<string, string | number | null | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value == null ? "" : String(value).trim()] as const)
      .filter(([, value]) => value.length > 0)
  )
}
