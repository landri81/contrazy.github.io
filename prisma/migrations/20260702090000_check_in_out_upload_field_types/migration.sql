ALTER TYPE "TransactionReportFieldType" ADD VALUE IF NOT EXISTS 'PHOTO';
ALTER TYPE "TransactionReportFieldType" ADD VALUE IF NOT EXISTS 'FILE';

ALTER TABLE "TransactionReportAsset"
ADD COLUMN IF NOT EXISTS "fieldId" TEXT;

CREATE INDEX IF NOT EXISTS "TransactionReportAsset_fieldId_idx"
ON "TransactionReportAsset"("fieldId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TransactionReportAsset_fieldId_fkey'
      AND table_name = 'TransactionReportAsset'
  ) THEN
    ALTER TABLE "TransactionReportAsset"
      ADD CONSTRAINT "TransactionReportAsset_fieldId_fkey"
      FOREIGN KEY ("fieldId") REFERENCES "TransactionReportField"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
