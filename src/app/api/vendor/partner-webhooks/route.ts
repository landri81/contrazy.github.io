import { NextResponse } from "next/server"

import { requirePartnerApiKeyOwner } from "@/features/partner-api/server/api-keys"
import {
  getVendorPartnerWebhooks,
  PARTNER_WEBHOOK_DELIVERY_PAGE_SIZE,
} from "@/features/partner-webhooks/server/vendor-webhooks"
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
      { defaultPageSize: PARTNER_WEBHOOK_DELIVERY_PAGE_SIZE, maxPageSize: 100 }
    )

    const data = await getVendorPartnerWebhooks(owner.vendorProfile.id, pagination.page, pagination.pageSize)
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Partner webhooks list failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Unable to load partner webhooks." }, { status: 500 })
  }
}
