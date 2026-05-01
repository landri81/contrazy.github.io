# Conntrazy — Full Development Completion Plan

## Context

The `contrazy-main` folder contains a Next.js 16 / Prisma / Stripe application that is **approximately 80–85% complete**. The core infrastructure, database schema, authentication, and most API routes are production-quality. The remaining work is a mix of unverified client-flow pages, a handful of missing middleware / hardening concerns, and the full production deployment setup. This plan finalises all remaining development so the MVP is end-to-end ready.

---

## Current State Assessment

### ✅ Fully implemented (confirmed by code review)

| Area | Files |
|---|---|
| Prisma schema (20+ models) | `prisma/schema.prisma` |
| NextAuth — Google + credentials, JWT, role guards | `src/lib/auth/` |
| Vendor dashboard — all sections, real DB queries | `src/features/dashboard/server/dashboard-data.ts` |
| Admin dashboard — user mgmt, vendor review, audit logs | `src/features/dashboard/components/dashboard-pages.tsx` |
| Transaction creation + QR code generation | `src/app/api/vendor/transactions/route.ts` |
| Contract template CRUD with merge-field dialog | `src/features/dashboard/components/contract-template-list.tsx` |
| Stripe Connect card (connect / resume flow) | `src/features/dashboard/components/stripe-connect-card.tsx` |
| Deposit control card (capture / release) | `src/features/dashboard/components/deposit-control-card.tsx` |
| Client profile form (step 1) | `src/features/client-flow/components/client-pages.tsx` |
| Client document upload — Cloudinary (step 2) | `src/features/client-flow/components/client-uploads-form.tsx` |
| Client KYC — Stripe Identity redirect button (step 3) | `src/features/client-flow/components/client-kyc-form.tsx` |
| Client signature — checkbox e-confirm (step 5) | `src/features/client-flow/components/client-sign-form.tsx` |
| Stripe checkout API (payment + deposit auth) | `src/app/api/client/[token]/checkout/route.ts` |
| Stripe webhook handler | `src/app/api/webhooks/stripe/route.ts` |
| Deposit capture / release API | `src/app/api/vendor/transactions/[transactionId]/deposit/route.ts` |
| Email notifications (Resend) | `src/lib/integrations/resend.ts` |
| Contract placeholder population | `src/features/client-flow/server/client-flow-data.ts` |
| 7-step client flow state machine + redirect guards | `src/features/client-flow/server/client-flow-data.ts` |

### ❓ Unverified — need to read and complete if stubbed

| Item | Location to check |
|---|---|
| Checklist template CRUD UI | `src/features/dashboard/components/checklist-template-list.tsx` |
| Vendor profile edit form | `src/app/(dashboard)/vendor/profile/page.tsx` + `src/app/api/vendor/profile/route.ts` |
| Contract review page (renders HTML contract) | `src/app/t/[token]/contract/page.tsx` + `contract-review-form.tsx` |
| Payment action form (Stripe redirect + stage polling) | `src/features/client-flow/components/payment-action-form.tsx` |
| KYC return page (Stripe Identity callback handler) | `src/app/t/[token]/kyc/return/page.tsx` |
| KYC API route (creates Stripe Identity session) | `src/app/api/client/[token]/kyc/route.ts` |
| Client complete page | `src/app/t/[token]/complete/page.tsx` |
| Admin vendor review actions | `src/features/dashboard/components/week-one-forms.tsx` |

### ❌ Confirmed missing — must be built

| Item | Priority |
|---|---|
| `src/middleware.ts` — route protection at edge | High |
| HTML email templates (proper markup, not plain text) | High |
| Deposit hold expiry notification (7-day warning) | Medium |
| `middleware.ts` QR-code SVG inline display in vendor links page | Medium |
| Currency selection (currently hard-coded EUR) | Medium |
| Production deployment: Vercel + Neon + Stripe webhooks + Cloudinary + Resend | Critical |

---

## Implementation Plan

### Phase 1 — Verify & Complete Unverified Components (Priority 1)

**Step 1.1 — Read all unverified files listed above.**  
For each one, determine: (a) fully working, (b) stub / placeholder, (c) broken.

**Step 1.2 — Checklist template CRUD**  
File: `src/features/dashboard/components/checklist-template-list.tsx`  
Expected: same pattern as `contract-template-list.tsx` — Dialog with name, description, and a list of `ChecklistItem` rows (label, type: DOCUMENT|PHOTO|TEXT, required toggle). Each item row needs add/remove. API calls to `/api/vendor/checklists` and `/api/vendor/checklists/[id]`.

**Step 1.3 — Vendor profile edit form**  
File: `src/app/(dashboard)/vendor/profile/page.tsx`  
Expected: A form with fields (businessName, businessEmail, supportEmail, businessPhone, businessAddress, businessCountry) that PATCHes `/api/vendor/profile`. Use the existing Zod schema in `src/features/dashboard/schemas/vendor-profile.schema.ts`.

**Step 1.4 — Contract review page**  
File: `src/app/t/[token]/contract/page.tsx`  
Expected: Fetches the populated contract HTML from `buildPopulatedContractContent()` in `client-flow-data.ts`. Renders safely inside `dangerouslySetInnerHTML` in a scrollable container. Includes a "I have read this agreement" confirm button that records the `CONTRACT_REVIEWED` event via `recordTransactionEvent` and redirects to `/sign`.

**Step 1.5 — Payment action form**  
File: `src/features/client-flow/components/payment-action-form.tsx`  
Expected: POSTs to `/api/client/[token]/checkout` to get a Stripe checkout URL, then redirects. Handles the two-stage flow (service payment first, then deposit if applicable). Shows correct labels based on the `financeStage` in the URL query params on return.

**Step 1.6 — KYC API route + KYC return page**  
Files: `src/app/api/client/[token]/kyc/route.ts` and `src/app/t/[token]/kyc/return/page.tsx`  
Expected:  
- POST `/api/client/[token]/kyc` → creates a Stripe Identity VerificationSession, stores `stripeVerificationSessionId` in `KycVerification`, returns `{ url }` for redirect.  
- GET `/t/[token]/kyc/return` → checks current KYC status from DB (updated by Stripe webhook `identity.verification_session.verified`). If VERIFIED, redirect to next step. If still pending, show polling or manual re-check button.  
- Stripe webhook must handle `identity.verification_session.verified` and `identity.verification_session.requires_input` to update `KycVerification.status`.

**Step 1.7 — Client complete page**  
File: `src/app/t/[token]/complete/page.tsx`  
Expected: Confirms transaction complete, shows vendor contact info, summarises what was agreed. No further action required.

**Step 1.8 — Admin vendor review actions (week-one-forms.tsx)**  
File: `src/features/dashboard/components/week-one-forms.tsx`  
Expected: `VendorReviewActions` component with Approve / Reject / Suspend buttons. POSTs to `/api/admin/users/[userId]/review`. Already used from `AdminUserDetailView`.

---

### Phase 2 — Missing Middleware & Security Hardening

**Step 2.1 — Create `src/middleware.ts`**  
Protect dashboard routes at the edge before page load:

```typescript
// Protect /vendor/*, /admin/*, /super-admin/* routes
// Public routes: /, /t/*, /login, /register, /api/auth/*, /api/webhooks/*, /api/client/*
// Redirect unauthenticated users to /login
// Redirect authenticated non-admins from /admin/* to /vendor
```

Use `withAuth` from `next-auth/middleware` or manual JWT check using `getToken` from `next-auth/jwt`.

**Step 2.2 — Verify input validation on all client API routes**  
Client-facing routes (`/api/client/[token]/*`) must:
- Validate token exists and is not expired
- Enforce step order (cannot pay before signing, etc.)
- Return consistent error shapes

---

### Phase 3 — HTML Email Templates

**Step 3.1 — Replace plain-text email functions with proper HTML**  
File: `src/lib/integrations/resend.ts`

Create proper HTML email templates for:
1. **Transaction completed** — client gets summary with vendor contact
2. **Vendor deposit alert** — vendor told deposit was authorized, with capture/release link
3. **Vendor deposit status** — outcome of capture or release
4. **Vendor review status** — approval / rejection notice with next steps
5. **Password reset** — secure reset link

Each template: branded header (Conntrazy), clear body, CTA button, footer with legal note. Use inline styles for email client compatibility.

---

### Phase 4 — Business Logic Completions

**Step 4.1 — Currency selection on transaction creation**  
`src/features/dashboard/components/transaction-creation-form.tsx`  
Add a `currency` field (dropdown: EUR, GBP, USD) stored on the transaction. Currently hardcoded to EUR in several places — propagate from transaction record.

**Step 4.2 — Deposit hold expiry (7-day window)**  
Stripe cancels uncaptured payment intents after ~7 days. Add a `TransactionEvent` and email notification when a deposit is about to expire:
- Option A: Cron job / Vercel cron checking deposit `authorizedAt + 7 days`
- Option B: Check expiry on vendor dashboard load and surface alert

For MVP, implement Option B (check on load, show alert in deposit control card).

**Step 4.3 — Revenue fee tracking (2% + 0.25 per deposit)**  
The `application_fee_amount` field in Stripe payment intents can be set to collect Conntrazy's cut on deposit holds. Add this as a configurable server env var `CONNTRAZY_DEPOSIT_FEE_PERCENT` and `CONNTRAZY_DEPOSIT_FEE_FIXED_CENTS` and apply in the checkout route when `financeStage === "deposit_authorization"`.

**Step 4.4 — QR code display in vendor links page**  
Currently `link.qrCodeSvg` is stored in DB but not displayed on the vendor links page. Add a modal/dialog that renders the inline SVG so vendors can download or print it.

---

### Phase 5 — Production Deployment

**Step 5.1 — Vercel project setup**
- Connect GitHub repo to Vercel
- Set all env vars from `.env.example`
- Configure `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to production domain
- Confirm `prisma migrate deploy` runs as part of build or is run manually

**Step 5.2 — Neon PostgreSQL production**
- Create production database on Neon
- Run `prisma migrate deploy` against production DB
- Set `DATABASE_URL` in Vercel

**Step 5.3 — Stripe webhook registration**
- Register `https://yourdomain.com/api/webhooks/stripe` in Stripe dashboard
- Events needed:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `identity.verification_session.verified`
  - `identity.verification_session.requires_input`
- Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

**Step 5.4 — Cloudinary & Resend production**
- Cloudinary: create upload preset if unsigned uploads are used; set folder structure
- Resend: verify sending domain, set `RESEND_FROM_EMAIL`

**Step 5.5 — Remove GitHub Pages setup**
- Remove any custom domain pointing to GitHub Pages as noted in Developer Handbook section 3

---

### Phase 6 — QA & End-to-End Validation

Run the critical paths from the Developer Handbook section 12 in order:

1. Vendor registers, logs in, fills profile → admin approves → vendor connects Stripe
2. Vendor creates contract template with merge fields
3. Vendor creates checklist with document requirements
4. Vendor creates transaction (payment + deposit + KYC required) → copies link
5. Client opens link → fills profile → uploads docs → completes KYC → reviews contract → signs → pays service → authorizes deposit
6. Vendor dashboard shows completed transaction with timeline
7. Vendor releases deposit → email sent to vendor
8. Test payment failure path (card declined)
9. Test KYC failure path (ID rejected)
10. Test admin vendor rejection flow

---

## Critical Files to Modify

| File | Change |
|---|---|
| `src/middleware.ts` | Create — edge route protection |
| `src/features/dashboard/components/checklist-template-list.tsx` | Complete if stub |
| `src/app/(dashboard)/vendor/profile/page.tsx` | Complete edit form if stub |
| `src/app/t/[token]/contract/page.tsx` | Complete HTML contract render |
| `src/features/client-flow/components/payment-action-form.tsx` | Complete Stripe redirect |
| `src/features/client-flow/components/contract-review-form.tsx` | Complete review + event recording |
| `src/app/api/client/[token]/kyc/route.ts` | Complete Stripe Identity session creation |
| `src/app/t/[token]/kyc/return/page.tsx` | Complete KYC callback handler |
| `src/app/t/[token]/complete/page.tsx` | Complete confirmation page |
| `src/lib/integrations/resend.ts` | Replace with HTML email templates |
| `src/app/api/client/[token]/checkout/route.ts` | Add fee logic |
| `src/features/dashboard/components/transaction-creation-form.tsx` | Add currency selector |

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

Work within each phase can be parallelised by file. Phase 5 (deployment) should be started in parallel with Phase 3–4 as it requires external account setup. Phase 6 validates all phases together.

---

## Verification

For each item:
- Run `npm run typecheck` after each change
- Run `npm run build` to confirm no build errors
- Start `npm run dev` and manually test the flow in browser
- Use Stripe test mode throughout (`sk_test_...`)
- Confirm Stripe webhook events are received using Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
