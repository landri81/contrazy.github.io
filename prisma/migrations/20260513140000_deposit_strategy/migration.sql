-- New DepositStrategy enum
CREATE TYPE "DepositStrategy" AS ENUM ('AUTHORIZATION_HOLD', 'CHARGE_REFUND');

-- New TransactionEventType values
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'DEPOSIT_CHARGED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'DEPOSIT_AUTO_REFUNDED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'DEPOSIT_AUTO_REFUND_SKIPPED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'DEPOSIT_REFUND_FAILED';

-- New columns on DepositAuthorization
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositStrategy" "DepositStrategy" NOT NULL DEFAULT 'AUTHORIZATION_HOLD';
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositAutoRefundAt" TIMESTAMP(3);
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositChargedAt" TIMESTAMP(3);
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositRefundedAt" TIMESTAMP(3);
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositRefundId" TEXT;
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositCapturedAmount" INTEGER;
ALTER TABLE "DepositAuthorization" ADD COLUMN "depositRefundedAmount" INTEGER;

CREATE INDEX "DepositAuthorization_depositStrategy_depositAutoRefundAt_idx"
  ON "DepositAuthorization"("depositStrategy", "depositAutoRefundAt");
