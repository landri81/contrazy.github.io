import { NextResponse } from "next/server"

import { connectPlatform, disconnectPlatform, PlatformConnectionError } from "@/features/partner-platforms/server/platform-connections"
import { getSuperAdminActor } from "@/lib/auth/super-admin-actor"
import { prisma } from "@/lib/db/prisma"
import { isPartnerPlatform } from "@/lib/partner-platforms/catalogue"

type Params = { params: Promise<{ userId: string; platform: string }> }

async function resolve(params: Params["params"]) {
  const { userId, platform } = await params
  if (!isPartnerPlatform(platform)) return { error: NextResponse.json({ success: false, message: "Unknown platform" }, { status: 404 }) }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorProfile: { select: { id: true } } } })
  if (!user?.vendorProfile) return { error: NextResponse.json({ success: false, message: "Vendor account not found" }, { status: 404 }) }
  return { vendorId: user.vendorProfile.id, platform }
}

function failure(error: unknown) {
  if (error instanceof PlatformConnectionError) {
    const status = error.code === "vendor_not_found" || error.code === "not_connected" ? 404 : error.code === "platform_unreachable" || error.code === "platform_refused" ? 502 : 409
    return NextResponse.json({ success: false, code: error.code, message: error.message }, { status })
  }
  console.error("Platform connection failed", error)
  return NextResponse.json({ success: false, message: "The platform connection failed." }, { status: 500 })
}

/** Connects the platform (LOCAZ) to this vendor account. Super admins only: the key has full partner access to it. */
export async function POST(_request: Request, { params }: Params) {
  const actor = await getSuperAdminActor()
  if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const target = await resolve(params)
  if ("error" in target) return target.error
  try {
    const connection = await connectPlatform(target.vendorId, target.platform, actor)
    return NextResponse.json({ success: true, connectedAt: connection.connectedAt.toISOString() })
  } catch (error) {
    return failure(error)
  }
}

/** Disconnects it: the platform is told, the key revoked and the webhook endpoint removed. */
export async function DELETE(_request: Request, { params }: Params) {
  const actor = await getSuperAdminActor()
  if (!actor) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const target = await resolve(params)
  if ("error" in target) return target.error
  try {
    const result = await disconnectPlatform(target.vendorId, target.platform, actor)
    return NextResponse.json({ success: true, notified: result.notified })
  } catch (error) {
    return failure(error)
  }
}
