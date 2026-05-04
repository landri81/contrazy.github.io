import { prisma } from "@/lib/db/prisma"

type PersistWebhookEventOptions = {
  eventId: string
  eventType: string
  vendorId: string | null
  transactionId: string | null
  error?: string | null
  provider?: string
}

async function resolveVendorId(vendorId: string | null, transactionId: string | null) {
  if (vendorId || !transactionId) {
    return vendorId
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { vendorId: true },
  })

  return transaction?.vendorId ?? null
}

/**
 * Persists a WebhookEvent record regardless of processing outcome.
 * Failures here are non-fatal — logged but never thrown to the caller.
 */
export async function persistWebhookEvent(options: PersistWebhookEventOptions): Promise<void> {
  const { eventId, eventType, vendorId, transactionId, error, provider = "stripe" } = options

  try {
    const resolvedVendorId = await resolveVendorId(vendorId, transactionId)
    const status = error ? "FAILED" : "PROCESSED"
    const payload = {
      id: eventId,
      type: eventType,
      transactionId,
      vendorId: resolvedVendorId,
      ...(error ? { error } : {}),
    }

    await prisma.webhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId: eventId,
        },
      },
      update: {
        vendorId: resolvedVendorId,
        transactionId,
        eventType,
        status,
        error,
        payload,
      },
      create: {
        vendorId: resolvedVendorId,
        transactionId,
        provider,
        providerEventId: eventId,
        eventType,
        status,
        error,
        payload,
      },
    })
  } catch (logErr: unknown) {
    console.error("[webhook] Failed to persist WebhookEvent:", logErr)
  }
}
