-- CreateEnum
CREATE TYPE "PostChargeType" AS ENUM ('DAMAGE', 'FUEL', 'TOLL', 'TOWING', 'FPS', 'TICKET_ADMIN_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "PostChargeStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REQUIRES_ACTION', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "PostCharge" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "externalRef" TEXT,
    "type" "PostChargeType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "proofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PostChargeStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "paymentIntentId" TEXT,
    "declineCode" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "paymentLinkToken" TEXT,
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "succeededAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostChargeAttempt" (
    "id" TEXT NOT NULL,
    "postChargeId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "outcome" TEXT,
    "declineCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostChargeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostChargeRefund" (
    "id" TEXT NOT NULL,
    "postChargeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostChargeRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostCharge_paymentIntentId_key" ON "PostCharge"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PostCharge_paymentLinkToken_key" ON "PostCharge"("paymentLinkToken");

-- CreateIndex
CREATE INDEX "PostCharge_vendorId_createdAt_idx" ON "PostCharge"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "PostCharge_status_nextRetryAt_idx" ON "PostCharge"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostCharge_transactionId_externalRef_key" ON "PostCharge"("transactionId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "PostChargeAttempt_idempotencyKey_key" ON "PostChargeAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PostChargeAttempt_postChargeId_attemptNo_key" ON "PostChargeAttempt"("postChargeId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "PostChargeRefund_stripeRefundId_key" ON "PostChargeRefund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "PostChargeRefund_postChargeId_idx" ON "PostChargeRefund"("postChargeId");

-- AddForeignKey
ALTER TABLE "PostCharge" ADD CONSTRAINT "PostCharge_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChargeAttempt" ADD CONSTRAINT "PostChargeAttempt_postChargeId_fkey" FOREIGN KEY ("postChargeId") REFERENCES "PostCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChargeRefund" ADD CONSTRAINT "PostChargeRefund_postChargeId_fkey" FOREIGN KEY ("postChargeId") REFERENCES "PostCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

