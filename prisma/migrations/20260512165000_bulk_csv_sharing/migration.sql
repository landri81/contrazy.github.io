CREATE TYPE "BulkShareBatchStatus" AS ENUM ('CREATING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TYPE "BulkShareRecipientStatus" AS ENUM ('PENDING', 'EMAIL_SENT', 'EMAIL_FAILED');

ALTER TABLE "Transaction" ADD COLUMN "bulkBatchId" TEXT;

CREATE TABLE "BulkShareBatch" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "configSnapshot" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BulkShareBatchStatus" NOT NULL DEFAULT 'CREATING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkShareBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulkShareRecipient" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionId" TEXT,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "BulkShareRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkShareRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_bulkBatchId_idx" ON "Transaction"("bulkBatchId");
CREATE INDEX "BulkShareBatch_vendorId_createdAt_idx" ON "BulkShareBatch"("vendorId", "createdAt");
CREATE INDEX "BulkShareBatch_status_createdAt_idx" ON "BulkShareBatch"("status", "createdAt");
CREATE UNIQUE INDEX "BulkShareRecipient_transactionId_key" ON "BulkShareRecipient"("transactionId");
CREATE UNIQUE INDEX "BulkShareRecipient_batchId_normalizedEmail_key" ON "BulkShareRecipient"("batchId", "normalizedEmail");
CREATE INDEX "BulkShareRecipient_normalizedEmail_idx" ON "BulkShareRecipient"("normalizedEmail");
CREATE INDEX "BulkShareRecipient_status_createdAt_idx" ON "BulkShareRecipient"("status", "createdAt");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_bulkBatchId_fkey"
FOREIGN KEY ("bulkBatchId") REFERENCES "BulkShareBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BulkShareBatch"
ADD CONSTRAINT "BulkShareBatch_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkShareRecipient"
ADD CONSTRAINT "BulkShareRecipient_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "BulkShareBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkShareRecipient"
ADD CONSTRAINT "BulkShareRecipient_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
