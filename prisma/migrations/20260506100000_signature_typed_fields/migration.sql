-- Add typed signature audit fields to SignatureRecord.
-- IF NOT EXISTS guards against re-running after a prior `prisma db push`.
ALTER TABLE "SignatureRecord"
    ADD COLUMN IF NOT EXISTS "typedValue" TEXT,
    ADD COLUMN IF NOT EXISTS "fontKey"    TEXT;
