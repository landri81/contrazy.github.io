import type { BlogPostStatus, LocaleCode } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { buildPaginationMeta } from "@/lib/pagination"

const BLOG_PAGE_SIZE = 9

export type BlogPostListItem = {
  id: string
  status: BlogPostStatus
  featured: boolean
  publishedAt: Date | null
  updatedAt: Date
  coverUrl: string | null
  locales: Array<{
    locale: LocaleCode
    slug: string
    title: string
    excerpt: string
    category: string | null
  }>
}

export type BlogPostDetail = {
  id: string
  status: BlogPostStatus
  featured: boolean
  authorId: string | null
  publishedAt: Date | null
  coverUrl: string | null
  coverPublicId: string | null
  createdAt: Date
  updatedAt: Date
  locales: Array<{
    id: string
    locale: LocaleCode
    slug: string
    title: string
    excerpt: string
    content: unknown
    contentHtml: string
    seoTitle: string | null
    seoDesc: string | null
    coverAlt: string | null
    category: string | null
    tags: string[]
    updatedAt: Date
  }>
}

export type PublicPost = {
  id: string
  status: BlogPostStatus
  featured: boolean
  publishedAt: Date | null
  coverUrl: string | null
  slug: string
  title: string
  excerpt: string
  category: string | null
  tags: string[]
  coverAlt: string | null
}

export type PublicPostDetail = {
  id: string
  featured: boolean
  publishedAt: Date | null
  coverUrl: string | null
  slug: string
  title: string
  excerpt: string
  contentHtml: string
  category: string | null
  tags: string[]
  coverAlt: string | null
  seoTitle: string | null
  seoDesc: string | null
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function getAdminBlogPosts(
  page: number,
  pageSize: number,
  filters: { q?: string; status?: string }
) {
  const where = {
    ...(filters.status ? { status: filters.status as BlogPostStatus } : {}),
    ...(filters.q
      ? {
          locales: {
            some: {
              OR: [
                { title: { contains: filters.q, mode: "insensitive" as const } },
                { excerpt: { contains: filters.q, mode: "insensitive" as const } },
                { searchText: { contains: filters.q, mode: "insensitive" as const } },
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
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        featured: true,
        publishedAt: true,
        updatedAt: true,
        coverUrl: true,
        locales: {
          select: {
            locale: true,
            slug: true,
            title: true,
            excerpt: true,
            category: true,
          },
        },
      },
    }),
  ])

  return { items, meta: buildPaginationMeta(total, page, pageSize) }
}

export async function getAdminBlogPost(id: string): Promise<BlogPostDetail | null> {
  return prisma.blogPost.findUnique({
    where: { id },
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
  }) as Promise<BlogPostDetail | null>
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function getPublicBlogPosts(
  locale: LocaleCode,
  page: number,
  pageSize = BLOG_PAGE_SIZE,
  q?: string
) {
  const where = {
    status: "PUBLISHED" as BlogPostStatus,
    locales: {
      some: {
        locale,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { excerpt: { contains: q, mode: "insensitive" as const } },
                { searchText: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    },
  }

  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        featured: true,
        publishedAt: true,
        coverUrl: true,
        locales: {
          where: { locale },
          select: {
            slug: true,
            title: true,
            excerpt: true,
            category: true,
            tags: true,
            coverAlt: true,
          },
        },
      },
    }),
  ])

  const items: PublicPost[] = posts
    .filter((p) => p.locales.length > 0)
    .map((p) => {
      const loc = p.locales[0]!
      return {
        id: p.id,
        status: p.status,
        featured: p.featured,
        publishedAt: p.publishedAt,
        coverUrl: p.coverUrl,
        slug: loc.slug,
        title: loc.title,
        excerpt: loc.excerpt,
        category: loc.category,
        tags: loc.tags,
        coverAlt: loc.coverAlt,
      }
    })

  return { items, meta: buildPaginationMeta(total, page, pageSize) }
}

export async function getPublicBlogPost(
  locale: LocaleCode,
  slug: string
): Promise<PublicPostDetail | null> {
  const postLocale = await prisma.blogPostLocale.findUnique({
    where: { locale_slug: { locale, slug } },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      category: true,
      tags: true,
      coverAlt: true,
      seoTitle: true,
      seoDesc: true,
      post: {
        select: {
          id: true,
          status: true,
          featured: true,
          publishedAt: true,
          coverUrl: true,
        },
      },
    },
  })

  if (!postLocale || postLocale.post.status !== "PUBLISHED") {
    return null
  }

  return {
    id: postLocale.post.id,
    featured: postLocale.post.featured,
    publishedAt: postLocale.post.publishedAt,
    coverUrl: postLocale.post.coverUrl,
    slug: postLocale.slug,
    title: postLocale.title,
    excerpt: postLocale.excerpt,
    contentHtml: postLocale.contentHtml,
    category: postLocale.category,
    tags: postLocale.tags,
    coverAlt: postLocale.coverAlt,
    seoTitle: postLocale.seoTitle,
    seoDesc: postLocale.seoDesc,
  }
}

export async function getSuggestedPosts(
  locale: LocaleCode,
  excludeId: string,
  category: string | null,
  limit = 3
): Promise<PublicPost[]> {
  const postSelect = {
    id: true,
    status: true,
    featured: true,
    publishedAt: true,
    coverUrl: true,
    locales: {
      where: { locale },
      select: { slug: true, title: true, excerpt: true, category: true, tags: true, coverAlt: true },
    },
  }

  const toPublicPost = (p: {
    id: string; status: BlogPostStatus; featured: boolean; publishedAt: Date | null; coverUrl: string | null;
    locales: Array<{ slug: string; title: string; excerpt: string; category: string | null; tags: string[]; coverAlt: string | null }>
  }): PublicPost | null => {
    const loc = p.locales[0]
    if (!loc) return null
    return { id: p.id, status: p.status, featured: p.featured, publishedAt: p.publishedAt, coverUrl: p.coverUrl,
      slug: loc.slug, title: loc.title, excerpt: loc.excerpt, category: loc.category, tags: loc.tags, coverAlt: loc.coverAlt }
  }

  const results: PublicPost[] = []
  const excludeIds: string[] = [excludeId]

  // Prefer same-category posts first
  if (category) {
    const sameCat = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", id: { notIn: excludeIds }, locales: { some: { locale, category } } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: postSelect,
    })
    for (const p of sameCat) {
      const pp = toPublicPost(p)
      if (pp) { results.push(pp); excludeIds.push(p.id) }
    }
  }

  // Fill remaining slots with recent posts from any category
  if (results.length < limit) {
    const recent = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", id: { notIn: excludeIds }, locales: { some: { locale } } },
      orderBy: { publishedAt: "desc" },
      take: limit - results.length,
      select: postSelect,
    })
    for (const p of recent) {
      const pp = toPublicPost(p)
      if (pp) results.push(pp)
    }
  }

  return results
}

export async function getPostAlternateLocales(
  locale: LocaleCode,
  slug: string
): Promise<Array<{ locale: LocaleCode; slug: string }>> {
  const row = await prisma.blogPostLocale.findUnique({
    where: { locale_slug: { locale, slug } },
    select: {
      post: {
        select: {
          status: true,
          locales: { select: { locale: true, slug: true } },
        },
      },
    },
  })
  if (!row || row.post.status !== "PUBLISHED") return []
  return row.post.locales as Array<{ locale: LocaleCode; slug: string }>
}

export async function getPublishedBlogSlugs(): Promise<Array<{ locale: string; slug: string }>> {
  const locales = await prisma.blogPostLocale.findMany({
    where: { post: { status: "PUBLISHED" } },
    select: { locale: true, slug: true },
  })
  return locales.map((l) => ({ locale: l.locale, slug: l.slug }))
}
