import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { checklistTemplatePayloadSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
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
      prisma.checklistTemplate.findMany({
        where: { vendorId: vendorProfile.id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.checklistTemplate.count({ where: { vendorId: vendorProfile.id } }),
    ])

    return NextResponse.json({
      items,
      ...buildPaginationMeta(totalCount, pagination.page, pagination.pageSize),
    })
  } catch (error) {
    console.error("List Checklist Templates Error:", error)
    return NextResponse.json({ success: false, message: "Failed to load checklists" }, { status: 500 })
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

    const body = await request.json()
    const parsedBody = checklistTemplatePayloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid checklist data" },
        { status: 400 }
      )
    }

    const { name, description, items } = parsedBody.data

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        description,
        vendorId: vendorProfile.id,
        items: {
          create: items.map((item, i: number) => ({
            label: item.label,
            description: item.description,
            type: item.type,
            required: item.required,
            sortOrder: i,
          }))
        }
      },
      include: {
        items: true
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
