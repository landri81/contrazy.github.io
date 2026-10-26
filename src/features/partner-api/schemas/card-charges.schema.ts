import { z } from "zod"

import { isoDateTime } from "@/features/partner-api/schemas/booking.schema"

/** Request bodies of the saved-card, hold, charge and refund routes (C5, C6). */

const MAX_CENTS = 1_000_000
const cents = z.number().int("amount must be whole cents").positive("amount must be greater than zero").max(MAX_CENTS)

export const partnerHoldCreateSchema = z.object({ amount: cents, force: z.boolean().optional() })
export const partnerHoldCaptureSchema = z.object({ amount: cents.optional() })
export const partnerHoldCancelSchema = z.object({}).strict()

export const partnerBookingReturnedSchema = z.object({ returnedAt: isoDateTime("returnedAt") })
export const partnerDetachCardSchema = z.object({}).strict()

export const PARTNER_CHARGE_TYPES = ["damage", "fuel", "toll", "towing", "fps", "ticket_admin_fee", "other"] as const

export const partnerChargeCreateSchema = z.object({
  type: z.enum(PARTNER_CHARGE_TYPES),
  amount: cents,
  description: z.string().trim().max(500).optional().nullable(),
  proofUrls: z.array(z.string().trim().url("proofUrls must be absolute URLs").refine((url) => /^https:\/\//i.test(url), "proofUrls must use https")).max(10).optional(),
  externalRef: z.string().trim().min(1).max(100).optional().nullable(),
})

export const partnerChargeRefundSchema = z.object({
  amount: cents.optional(),
  reason: z.string().trim().min(3, "reason is required").max(500),
})

/** `POST /bookings/:id/refunds` (C9): part or all of the rental payment, with a reason. */
export const partnerBookingRefundSchema = partnerChargeRefundSchema
