-- Drop the old two-column unique index that was created by Prisma as a unique index (not a table constraint).
-- The previous migration incorrectly used DROP CONSTRAINT which silently skipped it.
DROP INDEX IF EXISTS "DocumentAsset_transactionId_requirementId_key";

-- Ensure the new three-column unique index exists (safe to run if already present).
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAsset_transactionId_requirementId_slotIndex_key"
ON "DocumentAsset"("transactionId", "requirementId", "slotIndex");
