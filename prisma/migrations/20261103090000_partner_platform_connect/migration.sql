-- AlterTable
ALTER TABLE "PartnerApiKey" ADD COLUMN     "platformPartner" TEXT;

-- CreateTable
CREATE TABLE "PartnerPlatformConnection" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "webhookEndpointId" TEXT,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerPlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerPlatformConnection_vendorId_platform_idx" ON "PartnerPlatformConnection"("vendorId", "platform");

-- AddForeignKey
ALTER TABLE "PartnerPlatformConnection" ADD CONSTRAINT "PartnerPlatformConnection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
