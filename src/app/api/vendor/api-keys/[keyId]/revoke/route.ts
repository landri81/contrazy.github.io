import { NextResponse } from "next/server"

import { requirePartnerApiKeyOwner, revokePartnerApiKey } from "@/features/partner-api/server/api-keys"

export const dynamic = "force-dynamic"

export async function POST(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const owner = await requirePartnerApiKeyOwner()

    if (owner.response) {
      return owner.response
    }

    const { keyId } = await params
    const apiKey = await revokePartnerApiKey({
      vendorId: owner.vendorProfile.id,
      userId: owner.user.id,
      keyId,
    })

    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API key not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, apiKey })
  } catch (error) {
    console.error("Partner API key revocation failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Unable to revoke the API key." }, { status: 500 })
  }
}
