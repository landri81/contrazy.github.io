-- CreateEnum
CREATE TYPE "TransactionLinkStatus" AS ENUM ('ACTIVE', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionLinkActor" AS ENUM ('VENDOR', 'CLIENT', 'ADMIN', 'SYSTEM');

-- AlterEnum
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'LINK_UPDATED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'LINK_CANCELLED';

-- AlterTable
ALTER TABLE "TransactionLink"
ADD COLUMN "status" "TransactionLinkStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "cancelledBy" "TransactionLinkActor";

-- Backfill lifecycle state for existing links
UPDATE "TransactionLink"
SET "status" = CASE
  WHEN "completedAt" IS NOT NULL THEN 'COMPLETED'::"TransactionLinkStatus"
  WHEN "openedAt" IS NOT NULL THEN 'PROCESSING'::"TransactionLinkStatus"
  ELSE 'ACTIVE'::"TransactionLinkStatus"
END;

UPDATE "TransactionLink" AS "link"
SET
  "status" = 'CANCELLED'::"TransactionLinkStatus",
  "cancelledAt" = COALESCE("link"."openedAt", "link"."createdAt"),
  "cancelReason" = COALESCE("link"."cancelReason", 'Cancelled before the payment link management upgrade.'),
  "cancelledBy" = COALESCE("link"."cancelledBy", 'SYSTEM'::"TransactionLinkActor")
FROM "Transaction" AS "transaction"
WHERE "transaction"."id" = "link"."transactionId"
  AND "transaction"."status" = 'CANCELLED'
  AND "link"."completedAt" IS NULL;

-- CreateIndex
CREATE INDEX "TransactionLink_status_createdAt_idx" ON "TransactionLink"("status", "createdAt");
