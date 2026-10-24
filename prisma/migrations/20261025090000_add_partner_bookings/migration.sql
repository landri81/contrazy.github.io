-- C2: partner bookings (additive only)

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('DASHBOARD', 'PARTNER_API');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "endAt" TIMESTAMPTZ(3),
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "partnerMetadata" JSONB,
ADD COLUMN     "rentalDetails" JSONB,
ADD COLUMN     "returnUrl" TEXT,
ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'DASHBOARD',
ADD COLUMN     "startAt" TIMESTAMPTZ(3),
ADD COLUMN     "stepSwitches" JSONB,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "partnerAllowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PartnerIdempotencyKey" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerIdempotencyKey_createdAt_idx" ON "PartnerIdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerIdempotencyKey_vendorId_key_key" ON "PartnerIdempotencyKey"("vendorId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_vendorId_externalRef_key" ON "Transaction"("vendorId", "externalRef");

-- AddForeignKey
ALTER TABLE "PartnerIdempotencyKey" ADD CONSTRAINT "PartnerIdempotencyKey_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
