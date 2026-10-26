# Contrazy Partner API (2026-11-01)

The Partner API lets a booking platform (LOCAZ first) hand a booking to Contrazy, send the customer through the
steps the partner switches on (identity, contract, payment, card security…), follow every step by signed webhooks,
and later place a hold at pickup, charge the saved card after the rental and refund.

- Reference: [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1, every route, request and response).
- Examples: [`fixtures/`](./fixtures): one request per route body, typical responses, and one payload per webhook type.
  They are generated from or checked against the code by `src/features/partner-api/docs.test.ts`, so they never drift.
- Base URL: `https://contrazy.com/api/partner/v1`.

## Authentication and scopes

Send the vendor's API key as a bearer token:

```http
Authorization: Bearer cz_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are created by the vendor in the Contrazy dashboard (API keys) and shown once. `cz_test_` keys are for test
mode, `cz_live_` for live. Each key has scopes:

| Scope | Gives |
| --- | --- |
| `bookings:read` | `GET /ping`, `GET /bookings…`, reports |
| `bookings:write` | create, update, cancel bookings; pickup hold; return date; card detach |
| `charges:write` | post-rental charges and refunds |
| `webhooks:write` | webhook endpoints |

`GET /ping` checks a key and lists its scopes.

## Conventions

- Amounts are integer cents, currency EUR. Date-times are ISO 8601 with an offset (`2026-11-05T10:00:00+01:00`).
- Responses may gain fields at any time: ignore what you do not know. Request bodies are validated strictly
  (unknown step names and unknown PATCH fields are refused).
- Every response carries a `request_id` header; quote it when asking for support.
- Rate limit: 120 requests per minute per key (`429 rate_limited` with `Retry-After`).

### Errors

Every error has the same shape and an HTTP status that matches its code:

```json
{ "error": { "code": "card_in_use", "message": "A booking of this customer still needs the saved card.", "details": { "blockingBookings": [] } } }
```

The full list of codes is in `openapi.yaml` (`components.schemas.Error`). The ones a partner meets most:

| Code | Status | When |
| --- | --- | --- |
| `invalid_request` | 400 | body or query does not validate (`details.issues[]`) |
| `idempotency_key_required` / `idempotency_key_conflict` | 400 / 409 | see below |
| `booking_locked` | 409 | PATCH after the customer opened the link |
| `card_not_secured` | 409 | hold or charge without a saved card |
| `hold_not_recommended` | 409 | hold on a rental over 6 days without `force` |
| `hold_failed` | 402 | the card refused the hold (`details.declineCode`) |
| `charge_window_closed` | 409 | charge after the 90-day window |
| `proof_required` | 422 | fps / toll / towing charge without `proofUrls` |
| `card_in_use` | 409 | detach while a booking still needs the card |
| `refund_too_large` | 422 | refund above what is left on the charge |

### Idempotency

Booking creation, holds (place, capture, release), charges and refunds require an `Idempotency-Key` header
(1-255 printable ASCII characters, unique per operation, e.g. your own booking or charge id). Sending the same key
with the same body replays the first response with `Idempotent-Replayed: true`; the same key with another body is
`409 idempotency_key_conflict`. A request that failed frees its key so you can retry it. Behind this, every Stripe
call carries its own idempotency key, so a retried request never charges twice.

## Bookings and step switches

`POST /bookings` takes the partner's `externalRef`, the customer, `startAt` / `endAt` / `timezone`, the rental
details and the `steps` to run:

| Step | Customer sees |
| --- | --- |
| `identity` (+ `selfie`) | Stripe Identity document check (with a selfie match) |
| `documents` | document upload |
| `contract` | contract review and signature (rental fields filled in) |
| `checkIn` / `checkOut` | photo and mileage / fuel reports |
| `payment` | pays `amount` online |
| `cardSecurity` | accepts the 90-day card terms, then saves a card (with the payment, or alone) |
| `hold` | deposit hold during the flow (most rentals use the pickup hold instead) |

Switched-off steps show as "not required" to the customer. The response has `customerUrl` (send it to the
customer) and the step progress. Bookings can be changed with `PATCH` until the customer opens the link, and
cancelled with `POST /bookings/{id}/cancel`.

Customers with locale `it` get the English flow. `returnUrl` must be on one of the vendor's allowed origins: when the
customer finishes or cancels, the last screen offers "Return to <partner>" to
`returnUrl?booking=<externalRef>&status=completed|cancelled` (automatic after 5 s, can be stopped).

## Saved card, hold, return, charges

```mermaid
sequenceDiagram
    participant L as LOCAZ
    participant C as Contrazy
    participant U as Customer
    participant S as Stripe
    L->>C: POST /bookings (steps.cardSecurity, payment)
    C-->>L: 201 customerUrl
    L->>U: e-mail with customerUrl
    U->>C: accepts the 90-day card terms (exact text, IP, browser logged)
    U->>S: pays the rental and saves the card (one 3D Secure)
    C-->>L: webhook booking.payment_succeeded, booking.card_secured
    Note over L,C: Vehicle handed over
    L->>C: POST /bookings/{id}/hold {amount}
    C->>S: manual-capture authorization, off session
    C-->>L: 201 hold authorized + booking.hold_authorized
    Note over L,C: Vehicle returned
    L->>C: POST /bookings/{id}/hold/capture {amount} or /hold/cancel
    L->>C: POST /bookings/{id}/returned {returnedAt}
    C-->>L: windowEndsAt = returnedAt + 90 days
    Note over L,C: Weeks later: FPS notice, tolls…
    L->>C: POST /bookings/{id}/charges {type, amount, proofUrls}
    C->>S: off-session charge (key postcharge_{id}_attempt_{n})
    C-->>L: 201 charge + charge.succeeded / failed / requires_action
    Note over C,U: Declined: retries or a payment link (see below)
    L->>C: POST /charges/{id}/refunds {amount, reason} if needed
    Note over C: After windowEndsAt: the daily job detaches the card unless something is still open
```

- **Consent.** The card terms (`card-90d-v1`, French binding text with English alongside) name the vendor and its
  support e-mail; Contrazy stores the exact text, version, hash, time, IP and browser before any card form opens.
- **Hold.** Place it when the vehicle is handed over, not at booking. Card holds lapse after about 7 days: for
  rentals over 6 days rely on the saved card (or send `force: true`). A hold the bank lets lapse becomes
  `released`.
- **Window.** Charges are accepted until `windowEndsAt` (exact instant). Charges created before it can still be
  retried and paid through their link after it.
- **Charges.** Contrazy checks only hard rules; LOCAZ applies its caps and price schedule first. FPS, tolls and
  towing need the notice in `proofUrls`. Traffic fines themselves are never charged, only the admin fee.
- **When a charge is declined** (Spec v2.1 §9):

  | Decline | Contrazy does |
  | --- | --- |
  | `insufficient_funds`, `try_again_later`, `processing_error` | retries off session after 24 h, 48 h, 72 h, then a payment link |
  | generic decline, `do_not_honor`, others | one retry after 72 h, then a payment link |
  | `authentication_required` | payment link at once (3D Secure on session) |
  | `expired_card`, `incorrect_number` | card-update link: renewed consent, new card, charged at once |
  | `lost_card`, `stolen_card`, `pickup_card`, `fraudulent` | payment link, booking flagged for review |

  The link (`paymentLinkUrl` or `cardUpdateUrl`, Contrazy page `/{locale}/pay/{token}`) and `nextRetryAt` arrive in
  the `charge.failed` / `charge.requires_action` webhook. LOCAZ sends the customer e-mails and the D+3 / D+7 / D+14
  reminders.
- **Refunds.** Partial or full, always executed at Stripe, with a reason. Refunds made in the Stripe dashboard are
  picked up too (`refund.succeeded`).
- **Rental refunds.** `POST /bookings/{id}/refunds` refunds part or all of the rental payment (cancellation refund
  windows are the partner's rules: send the amount they give), with a reason, at Stripe. `booking.payment_refunded`
  follows, also for refunds made in the Stripe dashboard.
- **Detach.** `POST /customers/{cardSecurity.customerId}/detach-card` works only when no booking of that customer is
  unreturned, inside its window, has an unpaid charge or an open dispute; otherwise `409 card_in_use` lists them.
- **Disputes.** A damage claim the vendor opens on the deposit, or a chargeback the customer's bank opens, is the
  booking's `dispute` (`GET /bookings/{id}`) and arrives as `dispute.opened`, `dispute.updated` and `dispute.closed`.
  `status` is seen from the vendor (`open`, `under_review`, `won`, `lost`); chargebacks add the bank's `reason`, the
  `amount` and `evidenceDueBy`. The evidence (contract, identity check, photos, consent, notices) stays in Contrazy:
  `evidenceUrl` opens the booking in the vendor dashboard, where it is reviewed and downloaded.

## Webhooks

Register an HTTPS endpoint with `POST /webhook-endpoints` (the `whsec_` secret is returned once). Private and
loopback addresses are refused, also when a public name resolves to them. `POST /webhook-endpoints/{id}/test` sends
a `ping`.

Each delivery is a JSON `POST` with these headers:

```http
Contrazy-Signature: t=1793874000,v1=5f1c…
Contrazy-Event-Id: evt_…
Contrazy-Event-Type: booking.card_secured
Contrazy-Api-Version: 2026-11-01
Contrazy-Delivery-Attempt: 1
```

Verify the signature on the raw body before parsing it. With Node, the helper used by Contrazy itself:

```ts
import { verifyContrazySignature } from "@/lib/partner-webhooks/signature"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const valid = verifyContrazySignature(rawBody, request.headers.get("Contrazy-Signature"), process.env.CONTRAZY_WEBHOOK_SECRET!)
  if (!valid) return new Response("invalid signature", { status: 400 })

  const event = JSON.parse(rawBody) // { id, type, apiVersion, createdAt, data }
  // Ignore an event id you already processed, then handle event.type.
  return new Response(null, { status: 204 })
}
```

The signature is `HMAC-SHA256(secret, t + "." + rawBody)` in hex; events older than 5 minutes are refused by the
helper (replays). Answer any 2xx within 10 seconds. Anything else is retried after 1 min, 5 min, 30 min, 2 h, 6 h and
24 h (7 attempts); the vendor can resend from the dashboard. Deliveries to one endpoint keep their order; use the
event `id` (stable per endpoint and event) to drop duplicates.

Events (catalogue `2026-11-01`): `booking.created`, `booking.link_opened`, `booking.profile_submitted`,
`booking.documents_submitted`, `booking.identity_verified`, `booking.identity_failed` (with `selfie: { required,
status }`), `booking.contract_signed` (signed PDF URL), `booking.payment_succeeded`, `booking.payment_refunded`, `booking.card_secured`,
`booking.hold_authorized`, `booking.hold_captured`, `booking.hold_released`, `booking.check_in_submitted`,
`booking.check_out_submitted` (km, fuel, photos count, report URL), `booking.completed`, `booking.cancelled`,
`charge.succeeded`, `charge.failed`, `charge.requires_action`, `refund.succeeded`, `dispute.opened`,
`dispute.updated`, `dispute.closed`, plus `ping`. One example per
type is in [`fixtures/webhooks/`](./fixtures/webhooks). Payloads carry the booking summary, the customer's name and
e-mail, and per-event facts; never ID documents, selfies, card data or Stripe ids.

## Changelog

### 2026-11-01 (first version)

- API keys with scopes, uniform errors, `request_id`, 120 requests per minute.
- Bookings: create (idempotent), get by id or `externalRef`, update before the customer starts, cancel; rental
  fields in the contract; step switches; return link.
- Signed webhooks with retries and a resend action; catalogue above.
- Selfie match option on the identity step.
- Card security: consent log, one Stripe customer per client per vendor, card saved with the payment or alone.
- Pickup hold (place, capture, release), return date and 90-day window, card detach with blockers.
- Post-rental charges with per-attempt idempotency, retries by decline type, payment and card-update links,
  refunds, disputes.
- Dispute summary on the booking and `dispute.*` webhooks (damage claims and chargebacks), with a link to the
  evidence in the vendor dashboard.
