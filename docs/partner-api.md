# Contrazy Partner API (v1) - bookings

Base path: `/api/partner/v1`. Every request sends `Authorization: Bearer cz_test_…` (or `cz_live_…`).
Every response carries a `request_id` header. Errors always use one shape:

```json
{ "error": { "code": "return_url_not_allowed", "message": "…", "details": { } } }
```

Amounts are integers in cents (EUR only). Date-times are ISO 8601 with an offset (`2026-11-02T09:00:00+01:00`).

## Endpoints

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| GET | `/ping` | `bookings:read` | Key check |
| POST | `/bookings` | `bookings:write` | Create a booking (requires `Idempotency-Key`) |
| GET | `/bookings/{id}` | `bookings:read` | Booking status, step progress, contract, check-in/out and payment summaries |
| GET | `/bookings?externalRef={ref}` | `bookings:read` | Same, looked up by your own reference |
| PATCH | `/bookings/{id}` | `bookings:write` | Change dates, rental details, amounts or steps before the customer starts |
| POST | `/bookings/{id}/cancel` | `bookings:write` | Cancel with `{ "reason": "…" }` |

A booking that belongs to another vendor, or that was not created through the API, returns `404 not_found`.

## Create a booking

```http
POST /api/partner/v1/bookings
Idempotency-Key: 6f1c0f8e-booking-LZ-10023
Content-Type: application/json

{
  "externalRef": "LZ-10023",
  "customer": { "firstName": "Alice", "lastName": "Martin", "email": "alice@locaz.test", "phone": "+33612345678", "locale": "fr" },
  "startAt": "2026-11-02T09:00:00+01:00",
  "endAt": "2026-11-05T18:00:00+01:00",
  "timezone": "Europe/Paris",
  "rental": {
    "vehicle": { "model": "Peugeot 208", "plate": "AB-123-CD", "category": "Compact" },
    "pickup": { "place": "Nice Airport T2", "address": "Rue Costes et Bellonte, 06200 Nice" },
    "return": { "place": "Nice Airport T2" },
    "mileage": { "unlimited": false, "includedKm": 900, "extraKmPrice": 25 },
    "options": ["Child seat"],
    "protection": "Standard protection",
    "deductible": 120000,
    "deposit": 80000,
    "fuelPolicy": "Full to full",
    "priceLines": [{ "label": "Rental", "quantity": 3, "unit": "days", "unitAmount": 4500, "total": 13500 }]
  },
  "amount": 13500,
  "depositAmount": 80000,
  "currency": "EUR",
  "steps": { "identity": true, "documents": true, "contract": true, "checkIn": true, "checkOut": true, "payment": true, "hold": true },
  "returnUrl": "https://locaz.co/bookings/LZ-10023",
  "contractTemplateId": "optional",
  "metadata": { "agency": "nice-airport" }
}
```

`201 Created`:

```json
{ "id": "…", "reference": "TX-1A2B3C4D", "externalRef": "LZ-10023", "status": "link_sent",
  "customerUrl": "https://…/fr/t/…", "qrCodeSvg": "<svg…> (only when qrCode: true)",
  "steps": [{ "key": "identity", "required": true, "status": "pending", "startedAt": null, "completedAt": null }],
  "startAt": "2026-11-02T08:00:00.000Z", "endAt": "2026-11-05T17:00:00.000Z", "createdAt": "…" }
```

Notes:

- **Customer locale:** `customer.locale` accepts `fr`, `en` and `it`. The Contrazy customer flow is available in French and English only, so **`it` falls back to `en`**: the customer link, emails and contract are in English until an Italian translation exists. The booking keeps the requested locale (`customer.locale` in `GET`) next to the locale actually used (`customer.flowLocale`).
- `serviceDate` (shown on existing Contrazy screens) is the local date of `startAt` in `timezone` (IANA name, default `Europe/Paris`).
- `endAt` must be after `startAt`; `amount` is required when `steps.payment` is on and `depositAmount` when `steps.hold` is on; price line `total` must equal `quantity × unitAmount`.
- `steps.contract` uses `contractTemplateId`, else the vendor's default template, else the seeded "LOCAZ rental contract" template; with none, `422 contract_template_required`.
- `steps.selfie` and `steps.cardSecurity` are accepted as `false` only for now; `true` returns `422 step_requires_configuration` until those launch settings exist.
- `returnUrl` must match one of the vendor's allowed origins (scheme, host and port), else `422 return_url_not_allowed`.

### Idempotency

`Idempotency-Key` (1-255 printable ASCII characters) is required on `POST /bookings`.

- Same key + same body: the first `201` response is replayed with `Idempotent-Replayed: true`.
- Same key + different body: `409 idempotency_key_conflict`.
- Same key while the first request is still running: `409 idempotency_key_in_use` (`Retry-After: 2`).
- Errors are not stored: after a `4xx` you can retry with the same key once the cause is fixed. Keys are kept for 24 hours.

### Plan and account errors

| Status | Code | When |
| --- | --- | --- |
| 402 | `subscription_required` | No active Contrazy subscription |
| 402 | `plan_limit_reached` | Monthly transactions, QR codes or identity checks used up |
| 403 | `plan_feature_unavailable` | Identity checks or long deposits not in the plan |
| 403 | `vendor_not_approved` | The vendor profile is not approved yet |
| 409 | `external_ref_conflict` | A booking with this `externalRef` already exists |
| 422 | `stripe_not_connected` | Payment, hold or identity on without a connected Stripe account |

## Step switches

`identity`, `selfie`, `documents`, `contract`, `checkIn`, `checkOut`, `payment`, `cardSecurity`, `hold`. A step that is off is skipped in the customer flow and listed there as "not required"; `checkIn`/`checkOut` off means no report fields. The vendor dashboard shows the switches read-only. In `GET`, each step has `status` `pending`, `done` or `skipped` with `startedAt`/`completedAt`.

## Changing and cancelling

`PATCH /bookings/{id}` accepts `startAt`, `endAt`, `timezone`, `rental`, `steps`, `amount`, `depositAmount`. It is allowed only **before the customer starts** (the link was never opened and the status is still `link_sent`). After that it returns `409 booking_locked` and writes a `partner_api.booking_locked` audit row.

`POST /bookings/{id}/cancel` with `{ "reason": "…" }` closes the customer link (same as a vendor cancellation in the dashboard). Cancelling twice returns the cancelled booking; a completed booking returns `409 booking_not_cancellable`.

## Contract placeholders

`{{rental.vehicle}}`, `{{rental.plate}}`, `{{rental.start}}`, `{{rental.end}}` (booking time zone and locale), `{{rental.pickupPlace}}`, `{{rental.returnPlace}}`, `{{rental.kmIncluded}}`, `{{rental.options}}`, `{{rental.protection}}`, `{{rental.deductible}}`, `{{rental.deposit}}`, `{{rental.priceTable}}` (place it on its own line). Unknown placeholders render empty.

Seed the default bilingual template for a vendor (synthetic text, legal review pending; safe to run twice):

```bash
npm run locaz:seed-contract-template -- --vendor <vendorProfileId | owner email>
```
