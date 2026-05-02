import { prisma } from "@/lib/db/prisma"

type PersistWebhookEventOptions = {
  eventId: string
  eventType: string
  vendorId: string | null
  transactionId: string | null
  error?: string | null
}

/**
 * Persists a WebhookEvent record regardless of processing outcome.
 * Failures here are non-fatal — logged but never thrown to the caller.
 */
export async function persistWebhookEvent(options: PersistWebhookEventOptions): Promise<void> {
  const { eventId, eventType, vendorId, transactionId, error } = options

  try {
    await prisma.webhookEvent.create({
      data: {
        vendorId,
        provider: "stripe",
        eventType,
        status: error ? "FAILED" : "PROCESSED",
        payload: {
          id: eventId,
          type: eventType,
          transactionId,
          ...(error ? { error } : {}),
        },
      },
    })
  } catch (logErr: unknown) {
    console.error("[webhook] Failed to persist WebhookEvent:", logErr)
  }
}
