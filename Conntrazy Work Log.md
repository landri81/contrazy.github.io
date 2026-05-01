# Conntrazy Work Log

## Scope Reference

- `Conntrazy Client Proposal.md`
- `Conntrazy Developer Handbook.md`
- `Conntrazy Project Milestone Plan.md`

## Current Status

Core MVP implementation and local closeout are complete on the current branch.

Verified locally:

- `npm ci`
- `npm run prisma:migrate:deploy`
- `npm run prisma:generate`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Completed closeout work:

- dedicated Playwright env generated from `.env.local` as `.env.test.local`
- isolated E2E migration and seed path using the `contrazy_e2e` schema
- migration-first release scripts and docs
- public development schema baselined into Prisma migration history
- final repo docs aligned to migration-first and Playwright-based closeout

Not yet verified from this repo alone:

- Vercel production deployment
- live provider callback setup in production
- production Stripe webhook delivery
- Resend production sender/domain verification

## Delivered Platform Foundations

1. Runtime and architecture
   - Rebuilt the prototype into a real Next.js 16 App Router application.
   - Removed raw HTML runtime serving from the application path.
   - Organized code into feature-based server/UI boundaries.
2. Authentication and authorization
   - Credentials auth for application users.
   - Google OAuth through Auth.js.
   - Env-backed super admin bootstrap login.
   - Role-based route protection for vendor and admin areas.
3. Data and integrations
   - Prisma schema expanded for vendors, transactions, requirements, documents, KYC, signatures, payments, deposits, invites, sessions, audit logs, and webhook events.
   - Stripe Connect, Checkout, and Identity integration paths added.
   - Cloudinary direct upload signing flow added.
   - Resend email delivery helpers added.

## Delivered Vendor System

1. Vendor onboarding
   - Vendor login and profile completion flow.
   - Admin review status reflected in vendor experience.
   - Stripe Connect onboarding, refresh, and return handlers.
2. Vendor workspace
   - Contract template management.
   - Checklist / requirement management.
   - Transaction creation with secure token link and persisted QR code output.
   - Transaction detail view backed by real transaction state, finance records, signature, documents, KYC, and event timeline.
   - Deposit control actions for release and capture.
3. Vendor data views
   - Links, payments, deposits, signatures, KYC cases, clients, webhooks, and disputes mapped from the database rather than demo placeholders.

## Delivered Client Flow

1. Canonical route order
   - `/t/[token]/profile`
   - `/t/[token]/documents`
   - `/t/[token]/kyc`
   - `/t/[token]/contract`
   - `/t/[token]/sign`
   - `/t/[token]/payment`
   - `/t/[token]/complete`
2. Flow behavior
   - `/t/[token]` redirects to the first incomplete step.
   - Step gating runs from one transaction-backed source of truth.
   - Profile, documents, contract review, signature, and finance flows are idempotent.
3. Client actions
   - Profile save/update.
   - Cloudinary-backed uploads mapped per requirement.
   - Optional Stripe Identity verification.
   - Contract review without implicit signing.
   - Separate signature step.
   - Stripe service payment and deposit authorization orchestration.
   - Read-only completion behavior with webhook-backed finance reconciliation.

## Delivered Admin System

1. Admin routes
   - `/admin`
   - `/admin/users`
   - `/admin/users/[userId]`
   - `/admin/invites`
   - `/admin/logs`
   - `/admin/sessions`
   - `/admin/roles`
2. Admin capabilities
   - Vendor review updates with audit logging.
   - Real data visibility for users, vendors, invites, sessions, transactions, and webhook activity.
   - Read-only RBAC policy view rather than custom role-builder logic.

## Delivered Operational Logic

1. Transaction event system
   - Added persistent event records for link activity, documents, KYC, contract review, signature, finance, email delivery, and completion.
2. Finance orchestration
   - Service payments and deposit authorization are tracked independently.
   - Hybrid transactions run sequential service payment and deposit authorization steps.
   - Stripe webhooks are the source of truth for finance completion.
3. Email coverage
   - Password reset
   - Vendor review status
   - Client completion receipt
   - Vendor deposit authorization / release / capture notifications

## Remaining External Work

These items are outside the local codebase and still need completion before production handoff is fully closed:

1. Deploy to Vercel with real environment values.
2. Register production callback URLs for Auth.js, Stripe Connect, Stripe Identity, and Stripe webhooks.
3. Verify Resend sender/domain in the production environment.
4. Run final production smoke tests against deployed infrastructure.
