# Conntrazy Handover Checklist

## Environment Layout

### Local development

Set these in `.env.local`:

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
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ACCOUNT_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_BUSINESS_MONTHLY`
- `STRIPE_PRICE_BUSINESS_YEARLY`
- `STRIPE_PRO_TRIAL_DAYS`
- `STRIPE_BUSINESS_TRIAL_DAYS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `JWT_ENCRYPTION_SECRET`

### Disposable E2E environment

Generate `.env.test.local` from `.env.local` with:

```bash
npm run e2e:env
```

Defaults:

- app URL changes to `http://127.0.0.1:3100`
- Prisma uses the `contrazy_e2e` schema for isolated migrations and seeded browser tests

If you prefer a separate PostgreSQL database instead of a dedicated schema, update `DATABASE_URL` in `.env.test.local` after generation.

### Production on Vercel

Set these in Vercel for the production project:

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
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ACCOUNT_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_BUSINESS_MONTHLY`
- `STRIPE_PRICE_BUSINESS_YEARLY`
- `STRIPE_PRO_TRIAL_DAYS`
- `STRIPE_BUSINESS_TRIAL_DAYS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `JWT_ENCRYPTION_SECRET`

Vercel project settings:

- Framework preset: `Next.js`
- Install command: `npm ci`
- Build command: `npm run vercel-build`
- Root directory: `contrazy-main` if the connected repository includes files above the app folder
- Node.js version: `20.x`
- Do not add a custom `NODE_ENV` environment variable in Vercel

Runtime behavior:

- the repo ships with `vercel.json`
- Stripe, webhook, KYC, and deposit routes are pinned to the Node.js runtime with an increased function duration
- if `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` are unset in preview, backend URL generation falls back to `VERCEL_URL`

## Callback URLs

Configure these URLs with the production domain:

- Auth.js Google callback:
  `/api/auth/callback/google`
- Stripe Connect return:
  `/vendor/stripe/return`
- Stripe Connect refresh:
  `/vendor/stripe/refresh`
- Stripe Identity return:
  `/t/[token]/kyc/return`
- Password reset flow:
  `/reset-password`

## Webhook Endpoints

- Stripe webhook endpoint:
  `/api/webhooks/stripe`
- Stripe billing webhook endpoint:
  `/api/webhooks/stripe-account`

Recommended events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- any additional payment-intent lifecycle events your Stripe dashboard requires for monitoring
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Super Admin Bootstrap

- Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in production.
- This login path is env-backed and is intended for bootstrap/admin access.
- Normal admin and vendor records remain database-backed.

## Release Workflow

Local development default:

```bash
npm ci
npm run prisma:migrate:deploy
npm run prisma:generate
npm run dev
```

Playwright closeout:

```bash
npm run e2e:env
npm run prisma:migrate:deploy:test
npm run test:e2e
```

Production deployment path:

- use Prisma migrations with `prisma migrate deploy`
- do not rely on `prisma db push` for production release
- the current local development schema has already been baselined so future deploys track the checked-in migration history
- Vercel now uses `npm run vercel-build`, which runs `prisma generate`, `prisma migrate deploy`, and `next build`
- platform billing price IDs can be generated locally with `npm run stripe:setup-plans`

## Stripe Test Data

Use Stripe test mode before go-live.

- Standard successful card:
  `4242 4242 4242 4242`
- Any future expiry date
- Any CVC
- Any postal code

Use Stripe’s current test cards for authentication, declines, and 3DS verification when validating edge cases.

## Operational Notes

1. Deposits
   - Deposit authorization is separate from service payment.
   - Deposit release/capture is triggered from the vendor transaction view.
   - Stripe webhooks reconcile finance state and completion.
2. KYC
   - KYC is optional per transaction.
   - Stripe Identity return path updates verification state and advances the flow.
3. Uploads
   - Client uploads go directly to Cloudinary after the app signs the upload payload.
   - Persisted document records are tied to transaction requirements.
4. Emails
   - Verify the sending domain configured in `RESEND_FROM_EMAIL`.
   - Review provider-side logs after the first production flows.

## Final Production Smoke Test

Run one full transaction in production test mode:

1. Vendor signs in.
2. Vendor completes profile.
3. Admin approves vendor.
4. Vendor connects Stripe.
5. Vendor creates a transaction with uploads, optional KYC, contract, payment, and deposit as needed.
6. Client completes the secure link flow end to end.
7. Vendor confirms deposit release or capture behavior.
8. Admin verifies logs, users, sessions, and webhook activity.
