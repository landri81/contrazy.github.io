import { NextResponse } from "next/server"

import { signClientContract } from "@/features/client-flow/server/steps/sign-contract"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    const body = await request.json()

    const signatureDataUrl: unknown = body.signatureDataUrl
    const signedTimezone: string | null =
      typeof body.signedTimezone === "string" ? body.signedTimezone : null
    const signatureMethod: string =
      typeof body.signatureMethod === "string" ? body.signatureMethod : "draw"
    const typedValue: string | null =
      typeof body.typedValue === "string" ? body.typedValue.slice(0, 500) : null
    const fontKey: string | null =
      typeof body.fontKey === "string" ? body.fontKey.slice(0, 100) : null
    const signatureCity: string | null =
      typeof body.signatureCity === "string" ? body.signatureCity.trim().slice(0, 100) : null

    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null

    const result = await signClientContract(
      linkContext.link.id,
      { signatureDataUrl, signedTimezone, signatureMethod, typedValue, fontKey, signatureCity },
      ipAddress
    )

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Save Signature Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save signature" }, { status: 500 })
  }
}
