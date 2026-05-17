DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'DocumentAssetSource'
  ) THEN
    CREATE TYPE "DocumentAssetSource" AS ENUM ('UPLOAD', 'LIVE_CAPTURE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'CAPTURE'
      AND enumtypid = '"RequirementType"'::regtype
  ) THEN
    ALTER TYPE "RequirementType" ADD VALUE 'CAPTURE';
  END IF;
END $$;

ALTER TABLE "ChecklistItem"
ADD COLUMN IF NOT EXISTS "requiredFileCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "fileSlotLabels" JSONB;

ALTER TABLE "TransactionRequirement"
ADD COLUMN IF NOT EXISTS "requiredFileCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "fileSlotLabels" JSONB;

ALTER TABLE "DocumentAsset"
ADD COLUMN IF NOT EXISTS "slotIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "slotLabel" TEXT,
ADD COLUMN IF NOT EXISTS "source" "DocumentAssetSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);

UPDATE "DocumentAsset"
SET "slotIndex" = 0
WHERE "slotIndex" IS NULL;

ALTER TABLE "DocumentAsset"
DROP CONSTRAINT IF EXISTS "DocumentAsset_transactionId_requirementId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAsset_transactionId_requirementId_slotIndex_key"
ON "DocumentAsset"("transactionId", "requirementId", "slotIndex");
