import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { generateSlug } from "@/features/blog/server/slug-utils"
import type { BlogPostStatus, LocaleCode } from "@prisma/client"

export const runtime = "nodejs"

function isSuperAdmin(role: string | null | undefined) {
  return role === "SUPER_ADMIN"
}

function buildSearchText(title: string, excerpt: string, category?: string, tags?: string[]) {
  return [title, excerpt, category ?? "", ...(tags ?? [])].join(" ").toLowerCase()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { postId } = await params
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        featured: true,
        authorId: true,
        publishedAt: true,
        coverUrl: true,
        coverPublicId: true,
        createdAt: true,
        updatedAt: true,
        locales: {
          select: {
            id: true,
            locale: true,
            slug: true,
            title: true,
            excerpt: true,
            content: true,
            contentHtml: true,
            seoTitle: true,
            seoDesc: true,
            coverAlt: true,
            category: true,
            tags: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!post) {
      return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    console.error("Admin blog get error:", error)
    return NextResponse.json({ success: false, message: "Failed to load post" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { postId } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 })
    }

    const existing = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, publishedAt: true, locales: { select: { locale: true, slug: true } } },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 })
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
      locale?: LocaleCode
      title?: string
      excerpt?: string
      content?: unknown
      contentHtml?: string
      slug?: string
      category?: string
      tags?: string[]
      seoTitle?: string
      seoDesc?: string
      coverAlt?: string
      status?: BlogPostStatus
      featured?: boolean
      coverUrl?: string | null
      coverPublicId?: string | null
    }

    const newStatus = status ?? existing.status
    const wasPublished = existing.status === "PUBLISHED"
    const nowPublished = newStatus === "PUBLISHED"

    await prisma.$transaction(async (tx) => {
      await tx.blogPost.update({
        where: { id: postId },
        data: {
          ...(status !== undefined ? { status: newStatus } : {}),
          ...(featured !== undefined ? { featured } : {}),
          ...(coverUrl !== undefined ? { coverUrl } : {}),
          ...(coverPublicId !== undefined ? { coverPublicId } : {}),
          ...(!wasPublished && nowPublished ? { publishedAt: new Date() } : {}),
          ...(wasPublished && !nowPublished ? { publishedAt: null } : {}),
        },
      })

      if (locale) {
        const existingLocale = existing.locales.find((l) => l.locale === locale)

        let slug = existingLocale?.slug
        if (rawSlug && rawSlug !== existingLocale?.slug) {
          slug = await generateSlug(locale, rawSlug)
        } else if (title && !existingLocale) {
          slug = await generateSlug(locale, title)
        }

        const localeData = {
          ...(title !== undefined ? { title } : {}),
          ...(excerpt !== undefined ? { excerpt } : {}),
          ...(content !== undefined ? { content: content as object } : {}),
          ...(contentHtml !== undefined ? { contentHtml } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(tags !== undefined ? { tags } : {}),
          ...(seoTitle !== undefined ? { seoTitle } : {}),
          ...(seoDesc !== undefined ? { seoDesc } : {}),
          ...(coverAlt !== undefined ? { coverAlt } : {}),
          searchText: buildSearchText(
            title ?? existingLocale?.slug ?? "",
            excerpt ?? "",
            category,
            tags
          ),
        }

        if (existingLocale) {
          await tx.blogPostLocale.update({
            where: { postId_locale: { postId, locale } },
            data: localeData,
          })
        } else if (title && excerpt && content && slug) {
          await tx.blogPostLocale.create({
            data: {
              postId,
              locale,
              slug: slug!,
              title: title!,
              excerpt: excerpt!,
              content: content as object,
              contentHtml: contentHtml ?? "",
              searchText: buildSearchText(title, excerpt, category, tags),
              seoTitle: seoTitle ?? null,
              seoDesc: seoDesc ?? null,
              coverAlt: coverAlt ?? null,
              category: category ?? null,
              tags: tags ?? [],
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin blog update error:", error)
    return NextResponse.json({ success: false, message: "Failed to update post" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { postId } = await params
    await prisma.blogPost.delete({ where: { id: postId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin blog delete error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete post" }, { status: 500 })
  }
}
