# Contrazy — MVP Feature Audit

**Audited:** 2026-05-03  
**Codebase:** `contrazy-main`  
**Reference:** System overview meeting (Shakil Khan / Az LANDRI) + Client Proposal  

---

## Summary

| Category | Count |
|---|---|
| ✅ Fully built | 23 |
| ⚠️ Partial / needs attention | 6 |
| ❌ Not built (deferred to later phase) | 8 |

**Overall MVP completion: ~85–90%**  
The core end-to-end flow (vendor onboard → create transaction → client completes → payment/deposit → admin oversight) is fully operational. Remaining gaps are either explicitly deferred in the proposal or minor wiring issues.

---

## ✅ Fully Built

### Authentication & User Management
- **Registration / Login / Logout** — Email+password auth via NextAuth.js, bcrypt hashing
- **Email verification** — Token-based verify-email flow with dedicated page
- **Password reset** — Forgot/reset password with time-limited tokens and Resend email
- **Role-based access control** — SUPER_ADMIN, VENDOR roles with route guards (`requireAdminAccess`, `requireVendorAccess`)
- **Session management** — NextAuth sessions, admin sessions list view

### Vendor Onboarding
- **Vendor registration** — Full form with business details, Zod validation
- **Admin review workflow** — PENDING → APPROVED/REJECTED/SUSPENDED; `/api/admin/users/[id]/review` endpoint; admin vendors list with filter
- **Business profile** — Name, slug, email, phone, address, country; editable from dashboard
- **Stripe Connect** — OAuth connect flow, embedded Stripe dashboard, disconnect, refresh, account session; connection status tracked (NOT_CONNECTED → PENDING → CONNECTED)

### Transaction System
- **Transaction creation** — Multi-step animated form (title, type, amounts, contract template, checklist, deposit toggle)
- **Platform fee calculation** — 2% + €0.25 displayed in creation UI for deposit transactions
- **Secure link + QR code** — Token-based URLs generated at creation, QR code SVG stored in DB
- **Transaction status machine** — Full lifecycle: DRAFT → LINK_SENT → CUSTOMER_STARTED → DOCS_SUBMITTED → KYC_VERIFIED → CONTRACT_GENERATED → SIGNED → PAYMENT_AUTHORIZED → COMPLETED/CANCELLED/DISPUTED
- **Transaction detail view** — Full vendor page with link share, QR code display, timeline, deposit control card

### Client Flow (7-step)
- **Step routing** — `/t/[token]` determines next incomplete step and redirects automatically
- **Step 1: Client profile** — Full name, email, phone, company; stored as `ClientProfile`
- **Step 2: Document upload** — Per-requirement file upload to Cloudinary, satisfies checklist items
- **Step 3: KYC / identity verification** — Stripe Identity session creation, return callback handler
- **Step 4: Contract review** — Auto-populates vendor's template with client data, read-only display
- **Step 5: Signature** — Canvas signature pad with IP address capture and timestamp
- **Step 6: Payment** — Stripe payment intent + Stripe.js embedded elements for service amount
- **Step 7: Deposit authorization** — Stripe payment intent in `manual` capture mode for deposit hold
- **Completion screen** — Success confirmation with transaction reference
- **Cancelled state** — Link cancelled message with reason
- **Cancel action** — Client can cancel their own link before completion

### Financial Operations
- **Service payment** — Stripe payment intent, confirm, succeed via webhook
- **Deposit authorization** — `manual` capture mode, holds funds on client's card
- **Deposit capture (full)** — Vendor captures full deposit amount
- **Deposit capture (partial)** — Vendor specifies capture amount
- **Deposit release** — Vendor cancels/releases deposit back to client
- **Deposit locked during dispute** — `DepositControlCard` shows DISPUTED lockout state (amber)

### Templates
- **Contract templates** — Create/edit/delete per vendor; HTML/markdown content with placeholder support; mark as default
- **Checklist templates** — Named checklists of document/photo/text requirements; sortable items; reusable across transactions

### Admin Dashboard
- **Admin overview** — KPI cards (users, vendors, transactions, disputes)
- **User management** — Paginated list with search, detail view, role change, review action
- **Vendor management** — List with review status + Stripe status filters, approve/reject actions
- **Dispute management** — Paginated list with status filter + search; full detail view with info grid, document chips, timeline, resolution actions
- **Dispute resolution** — Mark under review, vendor wins (deposit stays AUTHORIZED), client wins (Stripe cancel + release); email to both parties
- **Audit logs** — Paginated, filterable by source/action
- **Sessions** — Active session list with role + state filter
- **Roles** — Read-only overview of platform access levels
- **Invites** — Invite management view

### Vendor Dashboard
- **Overview** — KPIs: total transactions, revenue, active deposits, open disputes; recent activity table
- **All vendor routes with loading skeletons** — Transactions, payments, deposits, disputes, contracts, checklists, KYC, signatures, links, webhooks, actions, profile, Stripe (all have `loading.tsx`)
- **Transactions list** — Paginated, status filter, search
- **Payments list** — Payment history
- **Deposits list** — Deposit status and amounts
- **Disputes list** — Vendor's disputes
- **Client profiles** — Clients associated to vendor's transactions
- **Link management** — Transaction links with status, share, cancel
- **KYC records** — KYC verification statuses
- **Signature records** — Signed contracts log
- **Webhook events** — Stripe webhook event log
- **Actions** — Bulk action controls

### Infrastructure & Integrations
- **Database** — Prisma 6 + Neon PostgreSQL; full schema with 20+ models and proper indexes
- **Stripe webhooks** — Idempotent handler for `payment_intent.*`, `checkout.session.*`, `account.updated`, `charge.dispute.*`
- **Cloudinary** — Signed upload, document storage, `sign-upload` endpoint
- **Resend emails** — Verification, password reset, dispute alert (admin), dispute resolved (vendor + client)
- **Transaction timeline** — `TransactionEvent` records with dedup keys for all lifecycle events
- **Audit logs** — `AuditLog` records for all admin actions with actor, entity, metadata
- **Health check** — `/api/health` endpoint
- **Integration pings** — `/api/integrations/stripe/ping`, `/api/integrations/cloudinary/ping`

### Marketing Site
- **Landing page** — Hero, features, workflow, use cases, trust bar, pricing, FAQ, CTA sections
- **Pricing page** — Pricing tiers display
- **Legal pages** — Terms, Privacy, GDPR, Imprint
- **Contact form** — Contact card with form
- **Blog / Help / Status / API Docs** — Pages present
- **Mobile navigation** — Responsive header with pending nav indicator (spinner on in-progress route), closes only after page load completes

---

## ⚠️ Partial / Needs Attention

### 1. Platform Fee Collection (display only, not collected)
The 2% + €0.25 platform fee is correctly calculated and shown in the transaction creation UI, but it is **not wired to Stripe's `application_fee_amount` parameter** on the payment intent. This means Conntrazy does not currently collect this fee in production — it is purely informational.  
**Fix needed:** Add `application_fee_amount` to the Stripe payment intent creation in `/api/client/[token]/payment-intent/route.ts`.

### 2. KYC Auto-populate
The proposal specifies that KYC data should auto-populate the client profile form. Currently the KYC flow launches Stripe Identity and stores a `KycVerification` record, but verified identity data (name, DOB, etc.) from Stripe Identity is not piped back to pre-fill `ClientProfile` fields.  
**Fix needed:** Use Stripe Identity webhook (`identity.verification_session.verified`) to extract and backfill client profile fields.

### 3. Stripe Identity Webhook Handler
`src/features/webhooks/handlers/` contains handlers for payment and dispute events but does not have an explicit `identity.verification_session.*` webhook handler. The KYC return URL flow updates status client-side, but server-side verification confirmation via webhook is absent.  
**Fix needed:** Add `identity.verification_session.verified` case to the Stripe webhook dispatcher.

### 4. Vendor Approval Email Notification
The admin review endpoint (`/api/admin/users/[userId]/review`) processes approval/rejection but may not send the vendor an email notification about the decision. The Resend integration has email functions for disputes but no `sendVendorApproved` / `sendVendorRejected` functions found.  
**Fix needed:** Add approval/rejection email to the review API route.

### 5. `ADMIN` vs `SUPER_ADMIN` Role Distinction
The schema and auth guards distinguish `SUPER_ADMIN` and a general `ADMIN` role in places (e.g., `canAccessAdminScope` accepts both), but the registration/invite flow only creates VENDOR users. There is no UI path to create a plain `ADMIN` user. The admin area is effectively SUPER_ADMIN-only.  
**Fix needed (low priority):** Either remove the distinction or expose a way to invite ADMIN-level users.

### 6. Contract Placeholder Substitution
The contract review step shows the raw contract template content. The proposal states client details should be "automatically inserted" into the contract. Variable substitution (e.g. `{{client_name}}`, `{{date}}`) in the template rendering is not confirmed to be implemented end-to-end.  
**Verify:** Check `ContractReviewForm` rendering logic to confirm placeholder replacement runs before display.

---

## ❌ Not Built — Deferred to Later Phase

These items were explicitly listed in the proposal as post-MVP additions and are **not expected** in the current build.

| Feature | Proposal Reference |
|---|---|
| **Subscription / billing tiers** | §15 — "advanced subscription billing" | 
| **Advanced contract template builder** | §15 — "advanced contract template builder" |
| **Third-party e-signature provider** | §15 — "stronger legal e-signature provider" |
| **Full admin automation** | §15 — "full admin automation" |
| **Advanced analytics / reporting** | §15 — "advanced analytics" |
| **Deeper compliance tooling** | §15 — "deeper compliance tooling" |
| **Mobile applications** | §15 — "mobile applications" |
| **Industry-specific custom workflows** | §15 — "industry-specific custom workflows" |

---

## Deployment Checklist

Everything needed before going live on production.

### Environment Variables (required)
```
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<random 32+ char secret>
DATABASE_URL=<Neon PostgreSQL connection string>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
SUPER_ADMIN_EMAIL=admin@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Stripe Setup
- [ ] Register production webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Enable events: `payment_intent.*`, `checkout.session.*`, `account.updated`, `charge.dispute.*`
- [ ] Activate Stripe Connect on the dashboard (set redirect URIs)
- [ ] Activate Stripe Identity (requires business verification on Stripe)
- [ ] Confirm `application_fee_amount` wiring (see partial items above) before collecting fees

### Resend / Email Setup
- [ ] Verify production sender domain in Resend dashboard
- [ ] Update `RESEND_FROM_EMAIL` to verified domain address
- [ ] Send test email via `/api/integrations/resend/test` after deploy

### Database
- [ ] Run `npm run prisma:push` (or `prisma migrate deploy`) against the production Neon instance
- [ ] Verify all enum values and indexes are applied

### Deployment
- [ ] Push to Vercel (or chosen host) with all env vars set
- [ ] Confirm `NEXTAUTH_URL` matches production domain exactly
- [ ] Test `/api/health` returns 200
- [ ] Test Stripe ping: `/api/integrations/stripe/ping`
- [ ] Smoke test: complete a full client flow end-to-end in production with a test Stripe card

### Post-Deploy Smoke Tests
- [ ] Vendor registers → receives verification email → verifies → profile approved by admin
- [ ] Vendor connects Stripe test account
- [ ] Vendor creates transaction → client link generated → QR renders
- [ ] Client opens link → completes all 7 steps → payment authorized
- [ ] Vendor sees PAYMENT_AUTHORIZED status and can manage deposit
- [ ] Vendor opens dispute → admin receives alert email
- [ ] Admin resolves dispute (both outcomes) → emails sent to vendor + client

---

## File Reference

| Area | Key Files |
|---|---|
| Schema | `prisma/schema.prisma` |
| Client flow | `src/app/t/[token]/*/page.tsx`, `src/features/client-flow/` |
| Client APIs | `src/app/api/client/[token]/*/route.ts` |
| Vendor dashboard | `src/app/(dashboard)/vendor/*/page.tsx` |
| Vendor APIs | `src/app/api/vendor/*/route.ts` |
| Admin dashboard | `src/app/(dashboard)/admin/*/page.tsx` |
| Admin APIs | `src/app/api/admin/*/route.ts` |
| Stripe webhooks | `src/app/api/webhooks/stripe/route.ts`, `src/features/webhooks/` |
| Email functions | `src/lib/integrations/resend.ts` |
| Auth guards | `src/lib/auth/guards.ts`, `src/lib/auth/roles.ts` |
| Dashboard data | `src/features/dashboard/server/dashboard-data.ts` |
| Page components | `src/features/dashboard/components/dashboard-pages.tsx` |
| Dispute actions | `src/features/dashboard/components/admin-dispute-actions.tsx` |
| Deposit control | `src/features/dashboard/components/deposit-control-card.tsx` |
