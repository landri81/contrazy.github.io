-- C3: partner outbound webhooks (additive only)

-- CreateEnum
CREATE TYPE "PartnerWebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- AlterEnum

ALTER TYPE "TransactionEventType" ADD VALUE 'CARD_SECURED';
ALTER TYPE "TransactionEventType" ADD VALUE 'CHARGE_SUCCEEDED';
ALTER TYPE "TransactionEventType" ADD VALUE 'CHARGE_FAILED';
ALTER TYPE "TransactionEventType" ADD VALUE 'CHARGE_REQUIRES_ACTION';
ALTER TYPE "TransactionEventType" ADD VALUE 'REFUND_SUCCEEDED';

-- CreateTable
CREATE TABLE "PartnerWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "encryptedSecret" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "transactionId" TEXT,
    "transactionEventId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "status" "PartnerWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBodySnippet" VARCHAR(1024),
    "lastError" VARCHAR(500),
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerWebhookEndpoint_vendorId_createdAt_idx" ON "PartnerWebhookEndpoint"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerWebhookDelivery_eventId_key" ON "PartnerWebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "PartnerWebhookDelivery_status_nextAttemptAt_idx" ON "PartnerWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PartnerWebhookDelivery_endpointId_createdAt_idx" ON "PartnerWebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerWebhookDelivery_transactionId_idx" ON "PartnerWebhookDelivery"("transactionId");

-- AddForeignKey
ALTER TABLE "PartnerWebhookEndpoint" ADD CONSTRAINT "PartnerWebhookEndpoint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWebhookDelivery" ADD CONSTRAINT "PartnerWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "PartnerWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWebhookDelivery" ADD CONSTRAINT "PartnerWebhookDelivery_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

