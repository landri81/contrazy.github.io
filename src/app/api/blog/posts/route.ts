import { NextResponse } from "next/server"

import { getPublicBlogPosts } from "@/features/blog/server/blog-data"
import { resolvePagination } from "@/lib/pagination"
import type { LocaleCode } from "@prisma/client"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = (searchParams.get("locale") ?? "en") as LocaleCode
    const page = Number(searchParams.get("page") ?? "1")
    const q = searchParams.get("q") ?? ""
    const PAGE_SIZE = 9

    const pagination = resolvePagination({ page, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
    const data = await getPublicBlogPosts(locale, pagination.page, PAGE_SIZE, q || undefined)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Public blog posts error:", error)
    return NextResponse.json({ success: false, message: "Failed to load posts" }, { status: 500 })
  }
}
