import { NextResponse } from "next/server"

import { requirePartnerApiKeyOwner } from "@/features/partner-api/server/api-keys"
import { sendPartnerWebhookDeliveryNow } from "@/features/partner-webhooks/server/delivery-worker"
import { prisma } from "@/lib/db/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Sends one partner webhook delivery again now (vendor owner only); audited. */
export async function POST(_request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const owner = await requirePartnerApiKeyOwner()

    if (owner.response) {
      return owner.response
    }

    const { deliveryId } = await params
    const result = await sendPartnerWebhookDeliveryNow(owner.vendorProfile.id, deliveryId)

    if (result.kind === "not_found") {
      return NextResponse.json({ success: false, message: "Delivery not found" }, { status: 404 })
    }

    if (result.kind === "endpoint_inactive") {
      return NextResponse.json(
        { success: false, code: "ENDPOINT_REMOVED", message: "This endpoint was deleted, so the delivery cannot be resent." },
        { status: 409 }
      )
    }

    await prisma.auditLog
      .create({
        data: {
          actorId: owner.user.id,
          actorType: "USER",
          action: "partner_webhook_delivery.resent",
          entityType: "PartnerWebhookDelivery",
          entityId: result.delivery.id,
          metadata: {
            vendorId: owner.vendorProfile.id,
            eventId: result.delivery.eventId,
            eventType: result.delivery.eventType,
            outcome: result.outcome,
            responseStatus: result.delivery.responseStatus,
          },
        },
      })
      .catch((error: unknown) => {
        console.error("Partner webhook resend audit skipped", error instanceof Error ? error.message : error)
      })

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      delivery: {
        id: result.delivery.id,
        status: result.delivery.status,
        attempt: result.delivery.attempt,
        responseStatus: result.delivery.responseStatus,
        error: result.delivery.lastError,
        nextAttemptAt: result.delivery.nextAttemptAt?.toISOString() ?? null,
        lastAttemptAt: result.delivery.lastAttemptAt?.toISOString() ?? null,
        deliveredAt: result.delivery.deliveredAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Partner webhook resend failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Unable to resend this delivery." }, { status: 500 })
  }
}
