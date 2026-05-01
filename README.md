# Conntrazy (Next.js 16 Foundation)

Week 1 migration of the original static HTML sample into a scalable Next.js 16 App Router application with a feature-based architecture.

## Stack

- Next.js 16 (App Router)
- Tailwind CSS + shadcn/ui
- Auth.js / NextAuth (Google OAuth + Credentials)
- PostgreSQL + Prisma
- Stripe, Cloudinary, Resend integration modules
- Redux Toolkit for client-side UI state
- JWT utility module (`jose`) for secure token workflows

## Architecture

```
src/
  app/                    # routes, layouts, API handlers
  features/               # feature-scoped UI and domain logic
  lib/                    # shared server/system modules
  store/                  # redux store and slices
  types/                  # type augmentation (next-auth)
prisma/
  schema.prisma           # database schema
legacy-html/
  ...                     # original client sample kept for reference
```

## Week 1 coverage

- HTML to Next.js base migration started (brand style preserved)
- Auth foundation:
  - Google OAuth
  - Email/password credentials
  - Super admin credentials from `.env.local`
- PostgreSQL schema + Prisma setup
- Integration foundations:
  - Cloudinary
  - Stripe
  - Resend
- Route protection middleware by role (`/vendor`, `/super-admin`)

## Legacy Route Migration (Current)

The full legacy experience is now served through Next route rewrites using original HTML/JS/CSS assets in `public/legacy/`, with deep-link support:

- Public routes: `/`, `/blog`, `/faq`, `/contact`, `/demo`, `/connexion`, `/inscription`, `/cgv`, `/rgpd`, etc.
- Vendor backoffice routes: `/vendor` and `/vendor/:section`
- Admin backoffice routes: `/super-admin` and `/super-admin/:section` (also `/backoffice/:section`)

## Environment

1. Copy `.env.example` to `.env.local` (already created in this workspace).
2. Set valid secrets and provider keys.
3. Ensure `DATABASE_URL` points to an accessible PostgreSQL instance.

## Commands

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Integration check routes

- `GET /api/health`
- `GET /api/integrations/google/ping`
- `GET /api/integrations/cloudinary/ping`
- `POST /api/integrations/cloudinary/sign-upload`
- `GET /api/integrations/stripe/ping`
- `POST /api/integrations/stripe/connect-account-link`
- `POST /api/integrations/resend/test`
