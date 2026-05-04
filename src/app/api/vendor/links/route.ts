import { NextResponse } from "next/server"

import { getVendorLinksPageData, getVendorRecentLinksData } from "@/features/dashboard/server/dashboard-data"
import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"

export async function GET(request: Request) {
  try {
    const { session, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get("page")
    const pageSize = searchParams.get("pageSize")
    const q = searchParams.get("q") ?? undefined
    const state = searchParams.get("state") ?? undefined
    const kind = searchParams.get("kind") ?? undefined
    const liveOnly = searchParams.get("liveOnly") === "1"
    const pagination = resolvePagination({ page, pageSize }, { defaultPageSize: 20, maxPageSize: 100 })

    if (liveOnly) {
      const items = await getVendorRecentLinksData(session.user.email, pagination.pageSize)

      return NextResponse.json({
        items,
        ...buildPaginationMeta(items.length, 1, pagination.pageSize),
      })
    }

    const data = await getVendorLinksPageData(session.user.email, pagination.page, pagination.pageSize, {
      q,
      state,
      kind,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("List Vendor Links Error:", error)
    return NextResponse.json({ success: false, message: "Failed to load payment links" }, { status: 500 })
  }
}
