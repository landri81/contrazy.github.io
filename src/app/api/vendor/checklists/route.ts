import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { checklistTemplatePayloadSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { normalizeRequirementExampleImage } from "@/features/dashboard/server/requirement-example-assets"
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

    let normalizedItems: Array<{
      label: string
      description: string | null
      type: typeof items[number]["type"]
      category: typeof items[number]["category"]
      customCategoryLabel: string | null
      required: boolean
      exampleImageUrl: string | null
      exampleImagePublicId: string | null
      exampleImageFileName: string | null
    }>

    try {
      normalizedItems = items.map((item) => {
        const normalizedExampleImage = normalizeRequirementExampleImage(item, item.type, vendorProfile.id)

        return {
          label: item.label,
          description: item.description,
          type: item.type,
          category: item.category,
          customCategoryLabel: item.customCategoryLabel,
          required: item.required,
          ...normalizedExampleImage,
        }
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Invalid example image data.",
        },
        { status: 400 }
      )
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        description,
        vendorId: vendorProfile.id,
        items: {
          create: normalizedItems.map((item, i: number) => ({
            label: item.label,
            description: item.description,
            type: item.type,
            category: item.category,
            customCategoryLabel: item.customCategoryLabel,
            required: item.required,
            exampleImageUrl: item.exampleImageUrl,
            exampleImagePublicId: item.exampleImagePublicId,
            exampleImageFileName: item.exampleImageFileName,
            sortOrder: i,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
