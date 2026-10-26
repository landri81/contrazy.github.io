import { describe, expect, it } from "vitest"

import { buildPaginationMeta, compactSearchParams, resolvePagination } from "@/lib/pagination"

describe("resolvePagination", () => {
  it("uses defaults when nothing is provided", () => {
    expect(resolvePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0 })
  })

  it("parses string input and computes skip", () => {
    expect(resolvePagination({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10, skip: 20 })
  })

  it("clamps invalid and out-of-range values", () => {
    expect(resolvePagination({ page: "-4", pageSize: "abc" })).toEqual({ page: 1, pageSize: 20, skip: 0 })
    expect(resolvePagination({ page: 2, pageSize: 5000 }, { maxPageSize: 50 })).toEqual({
      page: 2,
      pageSize: 50,
      skip: 50,
    })
  })
})

describe("buildPaginationMeta", () => {
  it("always reports at least one page", () => {
    expect(buildPaginationMeta(0, 1, 20)).toEqual({ totalCount: 0, page: 1, pageSize: 20, totalPages: 1 })
    expect(buildPaginationMeta(41, 1, 20).totalPages).toBe(3)
  })
})

describe("compactSearchParams", () => {
  it("drops empty values and stringifies the rest", () => {
    expect(compactSearchParams({ q: "  vans ", status: "", page: 2, sort: null, filter: undefined })).toEqual({
      q: "vans",
      page: "2",
    })
  })
})
