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
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
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
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `JWT_ENCRYPTION_SECRET`

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

Recommended events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- any additional payment-intent lifecycle events your Stripe dashboard requires for monitoring

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
