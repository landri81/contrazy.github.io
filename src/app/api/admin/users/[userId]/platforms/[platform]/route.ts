import { NextResponse } from "next/server"

import { connectPlatform, disconnectPlatform, PlatformConnectionError } from "@/features/partner-platforms/server/platform-connections"
import { USER_ROLES } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { isPartnerPlatform } from "@/lib/partner-platforms/catalogue"

type Params = { params: Promise<{ userId: string; platform: string }> }

/** Super admins only: a platform connection issues a key with full partner access to the vendor account. */
async function requireSuperAdmin() {
  const session = await getAuthSession()
  if (!session?.user?.id || !session.user.email || session.user.role !== USER_ROLES.SUPER_ADMIN) return null
  return { id: session.user.id, email: session.user.email }
}

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

/** Connects the platform (LOCAZ) to this vendor account. */
export async function POST(_request: Request, { params }: Params) {
  const actor = await requireSuperAdmin()
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
  const actor = await requireSuperAdmin()
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
