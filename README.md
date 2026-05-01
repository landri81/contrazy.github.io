# Conntrazy

Conntrazy is a Next.js 16 App Router MVP for vendor onboarding, secure client transaction flows, optional KYC, document collection, contract review, signature, service payment, deposit authorization, and admin oversight.

This repo no longer serves raw legacy HTML at runtime. `legacy-html/` is kept only as a visual reference source from the original prototype.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- shadcn/ui
- Auth.js / NextAuth
- Prisma + PostgreSQL
- Stripe Checkout + Stripe Connect + Stripe Identity
- Cloudinary
- Resend
- Redux Toolkit

## Architecture

```text
src/
  app/                    route tree, layouts, API handlers
  components/             shared UI primitives
  content/                typed marketing and static page content
  features/               feature-scoped UI, schemas, and server logic
  lib/                    auth, integrations, env, db, security
  store/                  client state
prisma/
  schema.prisma           relational data model
legacy-html/
  ...                     prototype reference only
```

## Route Groups

- Public marketing:
  `/`, `/pricing`, `/blog`, `/faq`, `/contact`, `/demo`, `/help`, `/status`, `/api-docs`, `/legal/*`
- Auth:
  `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/signup-success`
- Vendor workspace:
  `/vendor/*`
- Admin workspace:
  `/admin/*` with `/super-admin/*` alias support
- Tokenized client flow:
  `/t/[token]/*`

## MVP Coverage

- Vendor registration and login
- Env-backed super admin login
- Google OAuth
- Vendor profile completion and admin review
- Stripe Connect onboarding for vendors
- Contract template management
- Checklist / document requirement management
- Transaction creation with secure link and QR code
- Tokenized client profile, uploads, optional KYC, contract review, signature, payment, and completion steps
- Stripe webhook-driven finance reconciliation
- Deposit release / capture controls
- Cloudinary direct uploads
- Resend email notifications for password reset, vendor review status, completion, and deposit state changes
- Admin visibility for users, vendors, invites, logs, sessions, transactions, and webhooks

## Environment

Copy `.env.example` to `.env.local` and set real values.

Required keys:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `JWT_ENCRYPTION_SECRET`

## Commands

```bash
npm ci
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Verified Local Checks

The current repo state passes:

- `npm ci`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## External Deployment Work

The local implementation is ready for environment-level verification. The remaining non-code work is:

- Vercel deployment
- production callback URL configuration
- Stripe webhook registration
- Resend sender/domain verification
- final production smoke test with real provider credentials

See [Conntrazy Handover Checklist.md](./Conntrazy%20Handover%20Checklist.md) for the deployment checklist.
