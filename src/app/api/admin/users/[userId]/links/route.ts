import { NextResponse } from "next/server"
import { z } from "zod"

import { getAdminVendorLinksPage } from "@/features/dashboard/server/dashboard-data"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  linkStatus: z.enum(["ACTIVE", "PROCESSING", "COMPLETED", "CANCELLED"]).optional(),
  transactionStatus: z
    .enum([
      "DRAFT",
      "LINK_SENT",
      "CUSTOMER_STARTED",
      "DOCS_SUBMITTED",
      "KYC_VERIFIED",
      "CONTRACT_GENERATED",
      "SIGNED",
      "PAYMENT_AUTHORIZED",
      "COMPLETED",
      "CANCELLED",
      "DISPUTED",
    ])
    .optional(),
  kind: z.enum(["PAYMENT", "DEPOSIT", "HYBRID"]).optional(),
})

function json(body: unknown, status: number = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return json({ success: false, message: "Unauthorized" }, 401)
    }

    const { userId } = await params
    const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = querySchema.safeParse(searchParams)

    if (!parsed.success) {
      return json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid query parameters" },
        400
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        vendorProfile: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!user?.vendorProfile) {
      return json({ success: false, message: "Vendor profile not found" }, 404)
    }

    const links = await getAdminVendorLinksPage(user.vendorProfile.id, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      filters: parsed.data,
    })

    return json({ success: true, links })
  } catch (error) {
    console.error("Admin vendor links query failed", error)
    return json({ success: false, message: "Unable to load vendor links" }, 500)
  }
}
