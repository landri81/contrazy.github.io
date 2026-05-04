import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { getContractTemplateLimit } from "@/features/subscriptions/server/feature-gates"
import { prisma } from "@/lib/db/prisma"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"

export async function GET(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const { searchParams } = new URL(request.url)
    const pagination = resolvePagination(
      { page: searchParams.get("page"), pageSize: searchParams.get("pageSize") },
      { defaultPageSize: 12, maxPageSize: 100 }
    )

    const [items, totalCount] = await Promise.all([
      prisma.contractTemplate.findMany({
        where: { vendorId: vendorProfile.id },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.contractTemplate.count({ where: { vendorId: vendorProfile.id } }),
    ])

    return NextResponse.json({
      items,
      ...buildPaginationMeta(totalCount, pagination.page, pagination.pageSize),
    })
  } catch (error) {
    console.error("List Contract Templates Error:", error)
    return NextResponse.json({ success: false, message: "Failed to load templates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const { name, description, content } = await request.json()

    if (!name || !content) {
      return NextResponse.json({ success: false, message: "Name and content are required" }, { status: 400 })
    }

    const subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId: vendorProfile.id },
    })
    const templateLimit = getContractTemplateLimit(subscription)

    if (templateLimit !== null) {
      const existingCount = await prisma.contractTemplate.count({
        where: { vendorId: vendorProfile.id },
      })
      if (existingCount >= templateLimit) {
        return NextResponse.json(
          {
            success: false,
            message: `Your current plan allows up to ${templateLimit} contract template${templateLimit === 1 ? "" : "s"}. Upgrade to add more.`,
          },
          { status: 422 }
        )
      }
    }

    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        content,
        vendorId: vendorProfile.id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
