# Conntrazy — Deposit & Fee Flow

> **Audience:** Internal / client showcase  
> **Last updated:** 2026-05-13  
> **Scope:** Security-deposit lifecycle, fee collection, auto-refund automation, and Resend inbound forwarding

---

## 1. Deposit Strategy by Plan

Every transaction that includes a security deposit follows one of two strategies, assigned automatically based on the vendor's active subscription plan.

| Plan | Strategy | Window | Platform fee |
|------|----------|--------|--------------|
| **Starter** | `AUTHORIZATION_HOLD` | 7 days | Only on capture |
| **Pro** | `CHARGE_REFUND` | 14 days | Collected at charge, returned on refund |
| **Business** | `CHARGE_REFUND` | 30 days | Collected at charge, returned on refund |
| **Enterprise** | `CHARGE_REFUND` | 30 days | Collected at charge, returned on refund |

> **AUTHORIZATION_HOLD** — Stripe places a temporary hold on the customer's card. Money is never moved until the vendor explicitly captures it.  
> **CHARGE_REFUND** — Stripe immediately charges the customer's card. An automatic refund is issued at the end of the window unless the vendor decides to keep the deposit.

---

## 2. Fee Structure

```
Total cost to vendor on a captured deposit
──────────────────────────────────────────
Stripe processing fee   1.5% + €0.25   (deducted by Stripe)
Platform margin         0.5%            (collected by Conntrazy)
                        ─────────────────────────────────────
Total fee on capture    ≈ 2% + €0.25

Example — €1,000 deposit captured in full:
  Stripe fee        €15.25
  Platform fee      €5.00
  Vendor receives   €979.75

No fee on:  release · refund · cancellation · service payments
```

---

## 3. Strategy A — AUTHORIZATION_HOLD (Starter)

### How it works

The customer's card is pre-authorised. Stripe never moves money until the vendor triggers a capture. No platform fee is charged unless the deposit is captured.

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as Stripe
    participant DB as Database
    participant V as Vendor
    participant P as Platform

    C->>S: Card authorised (capture_method: manual)
    S-->>C: Hold placed on card
    S-->>DB: status = AUTHORIZED
    DB-->>V: Deposit hold active (dashboard)

    note over C,P: Hold window: 7 days

    alt Vendor captures (keeps deposit)
        V->>S: paymentIntents.capture(application_fee_amount = 0.5%)
        S-->>P: 0.5% routed to platform
        S-->>V: Net amount settled
        S-->>DB: status = CAPTURED
    else Vendor releases (returns to customer)
        V->>S: paymentIntents.cancel()
        S-->>C: Hold lifted, no charge
        S-->>DB: status = RELEASED
        note over P: No platform fee
    else Transaction cancelled
        V->>S: paymentIntents.cancel()
        S-->>C: Hold lifted automatically
        S-->>DB: status = CANCELLED
        note over P: No platform fee
    end
```

### Fee collection point

```mermaid
flowchart LR
    A([Card authorised\nNo money moved]) -->|Vendor captures| B([stripe.paymentIntents.capture\napplication_fee_amount = 0.5%])
    B --> C([Platform receives 0.5%])
    B --> D([Stripe takes 1.5% + €0.25])
    B --> E([Vendor nets remainder])

    A -->|Vendor releases| F([stripe.paymentIntents.cancel\nNo fee collected])
```

---

## 4. Strategy B — CHARGE_REFUND (Pro / Business)

### How it works

The customer's card is charged immediately (automatic capture). The platform fee is collected upfront via `application_fee_amount`. An auto-refund is scheduled for day 14 (Pro) or day 30 (Business). The vendor can override at any time before the deadline.

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as Stripe
    participant DB as Database
    participant V as Vendor
    participant P as Platform
    participant CR as Cron (hourly)

    C->>S: Card charged (capture_method: automatic)\napplication_fee_amount = 0.5%
    S-->>P: 0.5% fee collected immediately
    S-->>C: Receipt issued (statement: DEPOSIT / DÉPÔT GARANTIE)
    S-->>DB: status = SUCCEEDED\ndepositAutoRefundAt = Day 14 or 30

    note over C,CR: Auto-refund window active

    alt Vendor keeps deposit (before deadline)
        V->>DB: action = capture → status = CAPTURED
        note over S: No Stripe call needed\nMoney already settled
        note over P: Platform fee already collected ✓
    else Vendor refunds early
        V->>S: refunds.create(refund_application_fee: true)
        S-->>P: Platform fee returned to vendor
        S-->>C: Full refund issued
        S-->>DB: status = RELEASED
    else Auto-refund (deadline passed, cron)
        CR->>S: refunds.create(refund_application_fee: true)
        S-->>P: Platform fee returned to vendor
        S-->>C: Full refund issued
        S-->>DB: status = RELEASED\ndepositRefundedAt = now
    else Transaction cancelled
        V->>S: refunds.create(refund_application_fee: true)
        S-->>P: Platform fee returned to vendor
        S-->>C: Full refund issued
        S-->>DB: status = CANCELLED
    end
```

### Fee collection point

```mermaid
flowchart LR
    A([Card charged immediately\napplication_fee_amount = 0.5%]) --> B{Vendor decision}

    B -->|Keeps before deadline| C([status = CAPTURED\nPlatform keeps fee ✓])
    B -->|Refunds early| D([stripe.refunds.create\nrefund_application_fee: true\nPlatform fee returned])
    B -->|No action — cron fires| E([Auto-refund at deadline\nrefund_application_fee: true\nPlatform fee returned])
    B -->|Cancels transaction| F([Refund on cancel\nrefund_application_fee: true\nPlatform fee returned])
```

---

## 5. Complete Decision Flow (Both Strategies)

```mermaid
flowchart TD
    START([New transaction with deposit]) --> PLAN{Vendor plan?}

    PLAN -->|Starter| AUTH[AUTHORIZATION_HOLD\n7-day card hold]
    PLAN -->|Pro| CR14[CHARGE_REFUND\n14-day window]
    PLAN -->|Business / Enterprise| CR30[CHARGE_REFUND\n30-day window]

    AUTH --> AUTH_PAY[Customer authorises card\nNo money moved yet]
    CR14 --> CR_PAY[Customer card charged\n0.5% fee collected now]
    CR30 --> CR_PAY

    AUTH_PAY --> AUTH_ACTIVE{Vendor action?}
    CR_PAY --> CR_ACTIVE{Vendor action before deadline?}

    AUTH_ACTIVE -->|Capture| AUTH_CAP[stripe.paymentIntents.capture\napplication_fee_amount = 0.5%\nPlatform fee collected now]
    AUTH_ACTIVE -->|Release| AUTH_REL[stripe.paymentIntents.cancel\nNo fee]
    AUTH_ACTIVE -->|Cancel tx| AUTH_CAN[stripe.paymentIntents.cancel\nNo fee]

    CR_ACTIVE -->|Keep before deadline| CR_CAP[status = CAPTURED\nNo Stripe call\nFee already settled]
    CR_ACTIVE -->|Refund early| CR_REL[stripe.refunds.create\nrefund_application_fee: true\nFee returned]
    CR_ACTIVE -->|Cancel tx| CR_CAN[stripe.refunds.create\nrefund_application_fee: true\nFee returned]
    CR_ACTIVE -->|No action| CR_CRON[Hourly cron fires at deadline\nstripe.refunds.create\nrefund_application_fee: true\nFee returned]

    AUTH_CAP --> FEE_YES([Fee collected ✓\n1.5%+€0.25 → Stripe\n0.5% → Platform])
    CR_CAP --> FEE_YES

    AUTH_REL --> FEE_NO([No fee ✓])
    AUTH_CAN --> FEE_NO
    CR_REL --> FEE_NO
    CR_CAN --> FEE_NO
    CR_CRON --> FEE_NO
```

---

## 6. Auto-Refund Cron Job

The cron runs **every hour** via Vercel's built-in scheduler. It processes at most 50 overdue deposits per run to respect the function timeout.

```mermaid
flowchart TD
    CRON([Vercel Cron — every hour\nGET /api/cron/deposit-auto-refunds]) --> AUTH_CHECK{Authorization header\nBearer CRON_SECRET?}

    AUTH_CHECK -->|Invalid| REJECT([401 Unauthorized])
    AUTH_CHECK -->|Valid| QUERY[Query DB:\nstrategy = CHARGE_REFUND\nstatus = SUCCEEDED\ndepositAutoRefundAt ≤ now\ndepositRefundedAt = null\nLimit 50]

    QUERY --> LOOP{For each deposit}

    LOOP -->|Has Stripe intent| REFUND[stripe.refunds.create\nrefund_application_fee: true]
    LOOP -->|No intent| SKIP([Skip — log warning])

    REFUND -->|Success| UPDATE[Update DB:\nstatus = RELEASED\ndepositRefundedAt = now\ndepositRefundId = refund.id]
    UPDATE --> EVENT[Record DEPOSIT_AUTO_REFUNDED event]
    EVENT --> EMAIL[Send email:\nVendor notified\nCustomer notified]

    REFUND -->|Stripe error| FAIL[Record DEPOSIT_REFUND_FAILED event\nretry on next cron run]

    EMAIL --> LOOP
    FAIL --> LOOP

    LOOP -->|Done| RESULT([Return JSON:\nprocessed / skipped / failed counts])
```

> **Retry behaviour:** If a refund fails (network error, Stripe error), it is not retried in the same run. The deposit remains `status = SUCCEEDED` with `depositRefundedAt = null`, so the next hourly cron picks it up automatically.

---

## 7. Resend Inbound Email Forwarding

Any email received at the configured Resend inbound domain is verified and forwarded to `contrazy@lynael.com`.

```mermaid
sequenceDiagram
    autonumber
    participant EXT as External sender
    participant R as Resend (inbound)
    participant WH as /api/webhooks/resend/inbound
    participant DB as WebhookEvent (DB)
    participant FWD as contrazy@lynael.com

    EXT->>R: Sends email to inbound domain
    R->>WH: POST webhook\nevent type: email.received\nSvix headers: svix-id, svix-timestamp, svix-signature

    WH->>WH: Verify HMAC-SHA256 signature\n(RESEND_WEBHOOK_SECRET)
    alt Invalid signature or stale (> 5 min)
        WH-->>R: 401 Unauthorized
    end

    WH->>WH: Check event type = email.received\nIgnore all other event types

    WH->>DB: INSERT WebhookEvent\n(provider=resend_inbound, providerEventId=svix-id)
    alt Already processed (unique constraint)
        WH-->>R: 200 Already processed
    end

    WH->>R: resend.emails.send()\nto = RESEND_INBOUND_FORWARD_TO\nbcc = RESEND_AUDIT_BCC_EMAIL (optional)\nsubject = FWD: {original subject} [from: {sender}]

    R->>FWD: Forwarded email delivered
    WH->>DB: UPDATE status = PROCESSED
    WH-->>R: 200 OK
```

---

## 8. Database State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING : Deposit record created

    PENDING --> AUTHORIZED : AUTHORIZATION_HOLD\ncustomer card pre-authorised
    PENDING --> SUCCEEDED : CHARGE_REFUND\ncustomer card charged

    AUTHORIZED --> CAPTURED : Vendor captures hold\napplication_fee_amount collected
    AUTHORIZED --> RELEASED : Vendor releases hold\nno fee
    AUTHORIZED --> CANCELLED : Transaction cancelled\nno fee

    SUCCEEDED --> CAPTURED : Vendor keeps before deadline\nfee already collected
    SUCCEEDED --> RELEASED : Vendor refunds early\nor auto-refund cron fires\nfee returned
    SUCCEEDED --> CANCELLED : Transaction cancelled\nfee returned

    CAPTURED --> [*]
    RELEASED --> [*]
    CANCELLED --> [*]
```

---

## 9. Event Log (TransactionEvent)

Every state change produces an immutable event record with a `dedupeKey` to prevent duplicates.

| Event type | Triggered by | Strategy |
|------------|-------------|----------|
| `DEPOSIT_AUTHORIZED` | Customer completes auth hold | AUTHORIZATION_HOLD |
| `DEPOSIT_CHARGED` | Customer card charged | CHARGE_REFUND |
| `DEPOSIT_CAPTURED` | Vendor captures / keeps | Both |
| `DEPOSIT_RELEASED` | Vendor releases / refunds | Both |
| `DEPOSIT_AUTO_REFUNDED` | Cron auto-refund | CHARGE_REFUND |
| `DEPOSIT_AUTO_REFUND_SKIPPED` | Cron skips (missing intent) | CHARGE_REFUND |
| `DEPOSIT_REFUND_FAILED` | Stripe refund error | CHARGE_REFUND |
| `TRANSACTION_CANCELLED` | Transaction cancelled | Both |

---

## 10. Email Notifications

| Trigger | Recipients | Template |
|---------|-----------|----------|
| Deposit authorized (hold) | Vendor | `sendVendorDepositAlert` |
| Deposit charged | Customer | `sendDepositChargedEmail` |
| Vendor captures | Vendor + Customer | `sendVendorDepositStatusEmail` + `sendCustomerDepositStatusEmail` |
| Vendor releases | Vendor + Customer | `sendVendorDepositStatusEmail` + `sendCustomerDepositStatusEmail` |
| Auto-refund | Customer | `sendDepositAutoRefundedEmail` |
| Inbound email received | `contrazy@lynael.com` | Forwarded via Resend |

---

## 11. Environment Variables Required

```env
# Deposit cron authentication
CRON_SECRET=<random 32+ byte hex>

# Resend inbound email forwarding
RESEND_WEBHOOK_SECRET=whsec_...          # From Resend dashboard → Webhooks
RESEND_INBOUND_FORWARD_TO=contrazy@lynael.com
RESEND_AUDIT_BCC_EMAIL=                  # Optional — BCC on every forwarded email
```

> **Vercel Dashboard:** Add `CRON_SECRET` as a Production environment variable. Vercel injects it automatically as the `Authorization: Bearer` header on every cron invocation.

---

## 12. Security Guarantees

| Concern | Mitigation |
|---------|-----------|
| Cron endpoint called by anyone | `Authorization: Bearer CRON_SECRET` header required; 401 otherwise |
| Resend webhook replayed | Svix HMAC-SHA256 signature verified; events older than 5 min rejected |
| Duplicate webhook delivery | `WebhookEvent` unique constraint on `(provider, providerEventId)` |
| Double refund | Cron checks `depositRefundedAt IS NULL` before acting |
| Platform fee not collected on keep | `application_fee_amount` set at PaymentIntent creation for CHARGE_REFUND; Stripe guarantees it |
| Platform fee charged on release | `refund_application_fee: true` on every CHARGE_REFUND refund |
| Secrets in logs | No payment secrets, keys, or webhook bodies logged in production paths |
