import { NextResponse } from "next/server"

import { ChargeLinkError } from "@/features/card-security/server/charge-link"

const STATUS: Record<ChargeLinkError["code"], number> = {
  not_found: 404,
  settled: 409,
  wrong_mode: 409,
  not_confirmed: 422,
  intent_mismatch: 403,
}

/** JSON answer of the customer payment-link routes (`/api/pay/:token/*`). */
export async function chargeLinkResponse(run: () => Promise<Record<string, unknown>>) {
  try {
    return NextResponse.json({ success: true, ...(await run()) })
  } catch (error) {
    if (error instanceof ChargeLinkError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: STATUS[error.code] })
    }

    console.error("Charge link error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Something went wrong. Please try again." }, { status: 500 })
  }
}
