import { NextResponse } from "next/server"

import { generateSignedContractPdfPreview } from "@/features/contracts/server/contract-artifacts"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const transactionId = searchParams.get("transactionId")?.trim()
  const shouldDownload = searchParams.get("download") === "1"

  if (!transactionId) {
    return NextResponse.json(
      { success: false, message: "transactionId is required" },
      { status: 400 }
    )
  }

  try {
    const result = await generateSignedContractPdfPreview(prisma, { transactionId })

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Signed transaction preview is not available" },
        { status: 404 }
      )
    }

    return new NextResponse(result.pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Signed document PDF preview error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to generate signed document preview" },
      { status: 500 }
    )
  }
}
