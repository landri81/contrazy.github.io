import type { PartnerApiKey, PartnerApiKeyMode } from "@prisma/client"
import { NextResponse } from "next/server"

import type { CreatePartnerApiKeyInput } from "@/features/partner-api/schemas/api-key.schema"
import { canAccessVendorScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { generatePartnerApiKey } from "@/lib/partner-api/keys"

export const PARTNER_API_KEY_PAGE_SIZE = 20
export const PARTNER_API_KEY_MAX_ACTIVE = 25

export type PartnerApiKeyListItem = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  mode: PartnerApiKeyMode
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export type PartnerApiKeyListPage = {
  items: PartnerApiKeyListItem[]
  totalCount: number
  activeCount: number
  page: number
  pageSize: number
  totalPages: number
}

export function serializePartnerApiKey(apiKey: PartnerApiKey): PartnerApiKeyListItem {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    scopes: apiKey.scopes,
    mode: apiKey.mode,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
  }
}

/**
 * Keys follow the platform Stripe mode: a live Stripe secret key on this
 * deployment issues `cz_live_` keys, anything else issues `cz_test_` keys.
 */
export function resolvePartnerApiKeyMode(stripeSecretKey: string | undefined): PartnerApiKeyMode {
  return stripeSecretKey?.startsWith("sk_live_") ? "LIVE" : "TEST"
}

/**
 * Server-side guard for key management: the signed-in user must own the vendor
 * profile (VendorProfile.userId). Returns a JSON error response otherwise.
 */
export async function requirePartnerApiKeyOwner() {
  const session = await getAuthSession()

  if (!session?.user?.email || !canAccessVendorScope(session.user.role)) {
    return {
      response: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    } as const
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: { vendorProfile: true },
  })

  if (!user?.vendorProfile || user.vendorProfile.userId !== user.id) {
    return {
      response: NextResponse.json(
        { success: false, code: "NOT_VENDOR_OWNER", message: "Only the vendor account owner can manage API keys." },
        { status: 403 }
      ),
    } as const
  }

  return { response: null, user, vendorProfile: user.vendorProfile } as const
}

export async function listPartnerApiKeys(
  vendorId: string,
  page: number,
  pageSize = PARTNER_API_KEY_PAGE_SIZE
): Promise<PartnerApiKeyListPage> {
  const [items, totalCount, activeCount] = await Promise.all([
    prisma.partnerApiKey.findMany({
      where: { vendorId },
      orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.partnerApiKey.count({ where: { vendorId } }),
    countActivePartnerApiKeys(vendorId),
  ])

  return {
    items: items.map(serializePartnerApiKey),
    totalCount,
    activeCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  }
}

export async function countActivePartnerApiKeys(vendorId: string) {
  return prisma.partnerApiKey.count({ where: { vendorId, revokedAt: null } })
}

export async function createPartnerApiKey(input: {
  vendorId: string
  /** Null for the super admin of the environment variables, who has no user row. */
  userId: string | null
  mode: PartnerApiKeyMode
  data: CreatePartnerApiKeyInput
  /** Only for keys issued by a super admin platform connection (see partner-platforms). */
  platformPartner?: string | null
}) {
  const generated = generatePartnerApiKey(input.mode)

  const apiKey = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerApiKey.create({
      data: {
        vendorId: input.vendorId,
        name: input.data.name,
        prefix: generated.prefix,
        hashedKey: generated.hashedKey,
        scopes: input.data.scopes,
        mode: input.mode,
        createdById: input.userId,
        platformPartner: input.platformPartner ?? null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        actorType: "USER",
        action: "partner_api_key.created",
        entityType: "PartnerApiKey",
        entityId: created.id,
        metadata: {
          vendorId: input.vendorId,
          name: created.name,
          keyPrefix: created.prefix,
          scopes: created.scopes,
          mode: created.mode,
        },
      },
    })

    return created
  })

  // The clear key leaves the server exactly once, in this return value.
  return { apiKey: serializePartnerApiKey(apiKey), secret: generated.key }
}

export async function revokePartnerApiKey(input: { vendorId: string; userId: string | null; keyId: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.partnerApiKey.findFirst({
      where: { id: input.keyId, vendorId: input.vendorId },
    })

    if (!existing) {
      return null
    }

    if (existing.revokedAt) {
      return serializePartnerApiKey(existing)
    }

    const revoked = await tx.partnerApiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    })

    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        actorType: "USER",
        action: "partner_api_key.revoked",
        entityType: "PartnerApiKey",
        entityId: revoked.id,
        metadata: {
          vendorId: input.vendorId,
          name: revoked.name,
          keyPrefix: revoked.prefix,
        },
      },
    })

    return serializePartnerApiKey(revoked)
  })
}
