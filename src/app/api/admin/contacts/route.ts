import { NextResponse } from "next/server"

import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get("page") ?? "1")
    const q = searchParams.get("q") ?? ""
    const status = searchParams.get("status") ?? ""
    const PAGE_SIZE = 20

    const pagination = resolvePagination({ page, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })

    const where = {
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { message: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status: status as "NEW" | "READ" | "REPLIED" | "ARCHIVED" } : {}),
    }

    const [total, items] = await Promise.all([
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
    ])

    const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize)

    return NextResponse.json({ success: true, data: { ...meta, items } })
  } catch (error) {
    console.error("Admin contacts list error:", error)
    return NextResponse.json({ success: false, message: "Failed to load messages" }, { status: 500 })
  }
}
