import type { PartnerWebhookDeliveryStatus } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"

export const PARTNER_WEBHOOK_DELIVERY_PAGE_SIZE = 20

export type VendorPartnerWebhookEndpointItem = {
  id: string
  url: string
  description: string | null
  eventTypes: string[]
  secretPrefix: string
  active: boolean
  createdAt: string
  lastDelivery: { status: PartnerWebhookDeliveryStatus; at: string; nextAttemptAt: string | null } | null
}

export type VendorPartnerWebhookDeliveryItem = {
  id: string
  eventId: string
  eventType: string
  status: PartnerWebhookDeliveryStatus
  attempt: number
  responseStatus: number | null
  error: string | null
  nextAttemptAt: string | null
  lastAttemptAt: string | null
  deliveredAt: string | null
  createdAt: string
  endpointUrl: string
  endpointRemoved: boolean
  bookingReference: string | null
  externalRef: string | null
}

export type VendorPartnerWebhooksData = {
  endpoints: VendorPartnerWebhookEndpointItem[]
  deliveries: {
    items: VendorPartnerWebhookDeliveryItem[]
    totalCount: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/** Dashboard view of the vendor's partner endpoints and their most recent deliveries. */
export async function getVendorPartnerWebhooks(
  vendorId: string,
  page = 1,
  pageSize = PARTNER_WEBHOOK_DELIVERY_PAGE_SIZE
): Promise<VendorPartnerWebhooksData> {
  const deliveryWhere = { endpoint: { vendorId } }
  const [endpoints, deliveries, totalCount] = await Promise.all([
    prisma.partnerWebhookEndpoint.findMany({
      where: { vendorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          where: { lastAttemptAt: { not: null } },
          orderBy: { lastAttemptAt: "desc" },
          take: 1,
          select: { status: true, lastAttemptAt: true, nextAttemptAt: true },
        },
      },
    }),
    prisma.partnerWebhookDelivery.findMany({
      where: deliveryWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        endpoint: { select: { url: true, deletedAt: true, active: true } },
        transaction: { select: { reference: true, externalRef: true } },
      },
    }),
    prisma.partnerWebhookDelivery.count({ where: deliveryWhere }),
  ])

  return {
    endpoints: endpoints.map((endpoint) => {
      const last = endpoint.deliveries[0]

      return {
        id: endpoint.id,
        url: endpoint.url,
        description: endpoint.description,
        eventTypes: endpoint.eventTypes,
        secretPrefix: endpoint.secretPrefix,
        active: endpoint.active,
        createdAt: endpoint.createdAt.toISOString(),
        lastDelivery: last?.lastAttemptAt
          ? { status: last.status, at: last.lastAttemptAt.toISOString(), nextAttemptAt: last.nextAttemptAt?.toISOString() ?? null }
          : null,
      }
    }),
    deliveries: {
      items: deliveries.map((delivery) => ({
        id: delivery.id,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        status: delivery.status,
        attempt: delivery.attempt,
        responseStatus: delivery.responseStatus,
        error: delivery.lastError,
        nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
        lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        endpointUrl: delivery.endpoint.url,
        endpointRemoved: Boolean(delivery.endpoint.deletedAt) || !delivery.endpoint.active,
        bookingReference: delivery.transaction?.reference ?? null,
        externalRef: delivery.transaction?.externalRef ?? null,
      })),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  }
}
