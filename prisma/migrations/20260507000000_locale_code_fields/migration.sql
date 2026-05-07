-- Add LocaleCode enum and locale fields to VendorProfile and Transaction.
-- IF NOT EXISTS guards are not available for CREATE TYPE in PostgreSQL,
-- so we use DO $$ ... $$ to safely add the enum only when absent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocaleCode') THEN
    CREATE TYPE "LocaleCode" AS ENUM ('en', 'fr');
  END IF;
END$$;

ALTER TABLE "VendorProfile"
    ADD COLUMN IF NOT EXISTS "preferredLocale" "LocaleCode" NOT NULL DEFAULT 'en';

ALTER TABLE "Transaction"
    ADD COLUMN IF NOT EXISTS "locale" "LocaleCode" NOT NULL DEFAULT 'en';
