-- CreateEnum
CREATE TYPE "DisputeKind" AS ENUM ('DAMAGE_CLAIM', 'CHARGEBACK');

-- AlterEnum (PostgreSQL 12+: several values in one migration)
ALTER TYPE "TransactionEventType" ADD VALUE 'DISPUTE_UPDATED';
ALTER TYPE "TransactionEventType" ADD VALUE 'DISPUTE_CLOSED';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "evidenceDueBy" TIMESTAMP(3),
ADD COLUMN     "kind" "DisputeKind" NOT NULL DEFAULT 'DAMAGE_CLAIM',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "stripeDisputeId" TEXT;
