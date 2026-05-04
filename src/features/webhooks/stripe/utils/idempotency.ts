import { prisma } from "@/lib/db/prisma"

/**
 * Returns true if Stripe event `eventId` has already been successfully
 * processed, allowing the caller to skip duplicate deliveries.
 */
export async function isAlreadyProcessed(eventId: string, provider = "stripe"): Promise<boolean> {
  const existing = await prisma.webhookEvent.findFirst({
    where: {
      provider,
      OR: [
        { providerEventId: eventId },
        { payload: { path: ["id"], equals: eventId } },
      ],
    },
    select: { status: true },
  })

  return existing?.status === "PROCESSED"
}
