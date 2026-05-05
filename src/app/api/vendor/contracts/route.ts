import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { contractTemplatePayloadSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { getContractTemplateLimit, getContractTemplateLimitReachedMessage } from "@/features/subscriptions/server/feature-gates"
import { stripContractMarkup } from "@/features/contracts/contract-content"
import {
  CONTRACT_TEMPLATE_PAGE_SIZE,
  DEFAULT_CONTRACT_TEMPLATE_FILTER,
  DEFAULT_CONTRACT_TEMPLATE_SORT,
  normalizeContractTemplateFilterValue,
  normalizeContractTemplateSortValue,
} from "@/features/contracts/template-listing"
import { sanitizeContractTemplateContent } from "@/features/contracts/server/contract-rendering"
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
    const search = searchParams.get("q")?.trim() ?? ""
    const filter = normalizeContractTemplateFilterValue(searchParams.get("filter"))
    const sort = normalizeContractTemplateSortValue(searchParams.get("sort"))
    const pagination = resolvePagination(
      { page: searchParams.get("page"), pageSize: searchParams.get("pageSize") },
      { defaultPageSize: CONTRACT_TEMPLATE_PAGE_SIZE, maxPageSize: 100 }
    )

    const whereConditions: Prisma.ContractTemplateWhereInput[] = [{ vendorId: vendorProfile.id }]

    if (search) {
      whereConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      })
    }

    if (filter === "with_description") {
      whereConditions.push({ description: { not: null } })
      whereConditions.push({ NOT: { description: "" } })
    } else if (filter === "without_description") {
      whereConditions.push({
        OR: [{ description: null }, { description: "" }],
      })
    } else if (filter === "updated_recent") {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      whereConditions.push({ updatedAt: { gte: thirtyDaysAgo } })
    }

    const where: Prisma.ContractTemplateWhereInput =
      whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions }

    const orderBy: Prisma.ContractTemplateOrderByWithRelationInput | Prisma.ContractTemplateOrderByWithRelationInput[] =
      sort === "updated_asc"
        ? { updatedAt: "asc" }
        : sort === "name_asc"
          ? [{ name: "asc" }, { updatedAt: "desc" }]
          : sort === "name_desc"
            ? [{ name: "desc" }, { updatedAt: "desc" }]
            : { updatedAt: "desc" }

    const totalCount = await prisma.contractTemplate.count({ where })
    const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize))
    const page = Math.min(pagination.page, totalPages)

    const items = await prisma.contractTemplate.findMany({
      where,
      orderBy,
      skip: (page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    })

    return NextResponse.json({
      items,
      filter: filter ?? DEFAULT_CONTRACT_TEMPLATE_FILTER,
      q: search,
      sort: sort ?? DEFAULT_CONTRACT_TEMPLATE_SORT,
      ...buildPaginationMeta(totalCount, page, pagination.pageSize),
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

    const body = await request.json()
    const parsedBody = contractTemplatePayloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid template data" },
        { status: 400 }
      )
    }

    const { name, description, content } = parsedBody.data
    const sanitizedContent = sanitizeContractTemplateContent(content)

    if (!stripContractMarkup(sanitizedContent).trim()) {
      return NextResponse.json(
        { success: false, message: "Contract content is required" },
        { status: 400 }
      )
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
            message: getContractTemplateLimitReachedMessage(templateLimit),
          },
          { status: 422 }
        )
      }
    }

    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        content: sanitizedContent,
        vendorId: vendorProfile.id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
