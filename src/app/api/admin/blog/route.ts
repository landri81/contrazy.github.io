import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"
import { generateSlug } from "@/features/blog/server/slug-utils"
import type { BlogPostStatus, LocaleCode } from "@prisma/client"

export const runtime = "nodejs"

function isSuperAdmin(role: string | null | undefined) {
  return role === "SUPER_ADMIN"
}

export async function GET(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get("page") ?? "1")
    const q = searchParams.get("q") ?? ""
    const status = searchParams.get("status") ?? ""
    const PAGE_SIZE = 20

    const pagination = resolvePagination({ page, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })

    const where = {
      ...(status ? { status: status as BlogPostStatus } : {}),
      ...(q
        ? {
            locales: {
              some: {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { excerpt: { contains: q, mode: "insensitive" as const } },
                ],
              },
            },
          }
        : {}),
    }

    const [total, items] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          status: true,
          featured: true,
          publishedAt: true,
          updatedAt: true,
          coverUrl: true,
          locales: {
            select: { locale: true, slug: true, title: true, excerpt: true, category: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: { ...buildPaginationMeta(total, pagination.page, pagination.pageSize), items },
    })
  } catch (error) {
    console.error("Admin blog list error:", error)
    return NextResponse.json({ success: false, message: "Failed to load posts" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
    }

    const {
      locale,
      title,
      excerpt,
      content,
      contentHtml,
      slug: rawSlug,
      category,
      tags,
      seoTitle,
      seoDesc,
      coverAlt,
      status,
      featured,
      coverUrl,
      coverPublicId,
    } = body as {
      locale: LocaleCode
      title: string
      excerpt: string
      content: unknown
      contentHtml: string
      slug?: string
      category?: string
      tags?: string[]
      seoTitle?: string
      seoDesc?: string
      coverAlt?: string
      status?: BlogPostStatus
      featured?: boolean
      coverUrl?: string
      coverPublicId?: string
    }

    if (!locale || !title?.trim() || !excerpt?.trim() || !content) {
      return NextResponse.json(
        { success: false, message: "locale, title, excerpt and content are required" },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
    const slug = await generateSlug(locale, rawSlug ?? title)
    const searchText = buildSearchText(title, excerpt, category, tags)
    const postStatus: BlogPostStatus = status ?? "DRAFT"

    const post = await prisma.blogPost.create({
      data: {
        status: postStatus,
        featured: Boolean(featured),
        authorId: dbUser?.id ?? null,
        publishedAt: postStatus === "PUBLISHED" ? new Date() : null,
        coverUrl: coverUrl ?? null,
        coverPublicId: coverPublicId ?? null,
        locales: {
          create: {
            locale,
            slug,
            title,
            excerpt,
            content: content as object,
            contentHtml: contentHtml ?? "",
            searchText,
            seoTitle: seoTitle ?? null,
            seoDesc: seoDesc ?? null,
            coverAlt: coverAlt ?? null,
            category: category ?? null,
            tags: tags ?? [],
          },
        },
      },
      select: { id: true },
    })

    return NextResponse.json({ success: true, data: { id: post.id } }, { status: 201 })
  } catch (error) {
    console.error("Admin blog create error:", error)
    return NextResponse.json({ success: false, message: "Failed to create post" }, { status: 500 })
  }
}

function buildSearchText(
  title: string,
  excerpt: string,
  category?: string,
  tags?: string[]
) {
  return [title, excerpt, category ?? "", ...(tags ?? [])].join(" ").toLowerCase()
}
