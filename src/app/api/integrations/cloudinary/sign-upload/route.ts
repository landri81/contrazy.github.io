import { NextResponse } from "next/server"

import { resolveUploadFolderAccess } from "@/features/client-flow/server/upload-folder-access"
import { env } from "@/lib/env"
import { cloudinary } from "@/lib/integrations/cloudinary"

/**
 * Signs a browser upload to Cloudinary for one folder the caller may write to (security review, 22 Nov 2026): a
 * customer's own folders under a live secure link (documents, KYC, report photos), or a dispute's evidence folder for
 * the vendor who owns the transaction (or an admin). Anything else is refused, so the signature can't be used to
 * upload elsewhere.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { folder?: unknown }
  const folder = typeof body.folder === "string" ? body.folder.trim() : ""

  const access = await resolveUploadFolderAccess(folder)
  if (!access.allowed) {
    return NextResponse.json({ ok: false, message: "Upload not allowed." }, { status: access.status })
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, env.CLOUDINARY_API_SECRET)

    return NextResponse.json({
      ok: true,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder,
      timestamp,
      signature,
    })
  } catch (error) {
    console.error("Cloudinary signature error", error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, message: "Could not sign upload payload" }, { status: 500 })
  }
}
