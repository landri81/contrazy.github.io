import { NextResponse } from "next/server"

import { createPartnerApiKeySchema } from "@/features/partner-api/schemas/api-key.schema"
import {
  countActivePartnerApiKeys,
  createPartnerApiKey,
  listPartnerApiKeys,
  PARTNER_API_KEY_MAX_ACTIVE,
  PARTNER_API_KEY_PAGE_SIZE,
  requirePartnerApiKeyOwner,
  resolvePartnerApiKeyMode,
} from "@/features/partner-api/server/api-keys"
import { resolvePagination } from "@/lib/pagination"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const owner = await requirePartnerApiKeyOwner()

    if (owner.response) {
      return owner.response
    }

    const { searchParams } = new URL(request.url)
    const pagination = resolvePagination(
      { page: searchParams.get("page"), pageSize: searchParams.get("pageSize") },
      { defaultPageSize: PARTNER_API_KEY_PAGE_SIZE, maxPageSize: 100 }
    )

    const data = await listPartnerApiKeys(owner.vendorProfile.id, pagination.page, pagination.pageSize)
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Partner API key list failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Unable to load API keys." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requirePartnerApiKeyOwner()

    if (owner.response) {
      return owner.response
    }

    const body = await request.json().catch(() => null)
    const parsed = createPartnerApiKeySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid API key details" },
        { status: 400 }
      )
    }

    const activeCount = await countActivePartnerApiKeys(owner.vendorProfile.id)

    if (activeCount >= PARTNER_API_KEY_MAX_ACTIVE) {
      return NextResponse.json(
        {
          success: false,
          code: "API_KEY_LIMIT",
          message: `You can have at most ${PARTNER_API_KEY_MAX_ACTIVE} active API keys.`,
        },
        { status: 409 }
      )
    }

    const result = await createPartnerApiKey({
      vendorId: owner.vendorProfile.id,
      userId: owner.user.id,
      mode: resolvePartnerApiKeyMode(process.env.STRIPE_SECRET_KEY),
      data: parsed.data,
    })

    return NextResponse.json(
      { success: true, apiKey: result.apiKey, secret: result.secret },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Partner API key creation failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Unable to create the API key." }, { status: 500 })
  }
}
