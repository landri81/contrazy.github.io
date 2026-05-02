import type Stripe from "stripe"

import { handleAccountUpdated } from "@/features/webhooks/stripe/handlers/account"
import {
  handleCheckoutExpired,
  handleCheckoutPaymentFailed,
  handleCheckoutSuccess,
} from "@/features/webhooks/stripe/handlers/checkout-session"
import {
  handleDisputeCreated,
  handleDisputeUpdated,
} from "@/features/webhooks/stripe/handlers/dispute"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

const UNHANDLED: WebhookHandlerResult = { vendorId: null, transactionId: null }

/**
 * Routes a verified Stripe event to the appropriate handler.
 *
 * Returns a `WebhookHandlerResult` with ids discovered during processing.
 * Throws if the handler itself throws — the caller is responsible for catching
 * and persisting a FAILED WebhookEvent.
 *
 * Adding support for a new Stripe event type means:
 *   1. Create (or extend) a handler file under `handlers/`
 *   2. Add a case here
 */
export async function dispatchStripeEvent(event: Stripe.Event): Promise<WebhookHandlerResult> {
  const { id: eventId, type: eventType } = event

  switch (eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutSuccess(
        event.data.object as Stripe.Checkout.Session,
        eventId,
        eventType
      )

    case "checkout.session.async_payment_failed":
      return handleCheckoutPaymentFailed(
        event.data.object as Stripe.Checkout.Session,
        eventId,
        eventType
      )

    case "checkout.session.expired":
      return handleCheckoutExpired(
        event.data.object as Stripe.Checkout.Session,
        eventId,
        eventType
      )

    case "charge.dispute.created":
      return handleDisputeCreated(
        event.data.object as Stripe.Dispute,
        eventId,
        eventType
      )

    case "charge.dispute.updated":
    case "charge.dispute.closed":
      return handleDisputeUpdated(
        event.data.object as Stripe.Dispute,
        eventId,
        eventType
      )

    case "account.updated":
      return handleAccountUpdated(
        event.data.object as Stripe.Account,
        eventId,
        eventType,
      )

    default:
      return UNHANDLED
  }
}
