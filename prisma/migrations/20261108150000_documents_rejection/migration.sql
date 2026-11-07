-- LOCAZ T21: the vendor refuses a booking's documents; the customer uploads them again.
ALTER TYPE "TransactionEventType" ADD VALUE 'DOCUMENTS_REJECTED';

ALTER TABLE "Transaction" ADD COLUMN "documentsRejectedAt" TIMESTAMP(3),
ADD COLUMN "documentsRejectionReason" TEXT;
