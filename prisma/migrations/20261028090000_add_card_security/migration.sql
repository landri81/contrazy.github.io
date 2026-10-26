-- CreateEnum
CREATE TYPE "CardSecurityStatus" AS ENUM ('PENDING', 'SECURED', 'EXPIRED', 'DETACHED');

-- CreateTable
CREATE TABLE "PartnerCustomer" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSecurity" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "partnerCustomerId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "CardSecurityStatus" NOT NULL DEFAULT 'PENDING',
    "setupIntentId" TEXT,
    "paymentIntentId" TEXT,
    "paymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "securedAt" TIMESTAMP(3),
    "windowEndsAt" TIMESTAMP(3),
    "detachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "textFr" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" VARCHAR(512),
    "externalRef" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCustomer_vendorId_email_key" ON "PartnerCustomer"("vendorId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCustomer_vendorId_stripeCustomerId_key" ON "PartnerCustomer"("vendorId", "stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSecurity_transactionId_key" ON "CardSecurity"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSecurity_setupIntentId_key" ON "CardSecurity"("setupIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSecurity_paymentIntentId_key" ON "CardSecurity"("paymentIntentId");

-- CreateIndex
CREATE INDEX "CardSecurity_partnerCustomerId_status_idx" ON "CardSecurity"("partnerCustomerId", "status");

-- CreateIndex
CREATE INDEX "CardSecurity_status_windowEndsAt_idx" ON "CardSecurity"("status", "windowEndsAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_transactionId_consentAt_idx" ON "ConsentRecord"("transactionId", "consentAt");

-- AddForeignKey
ALTER TABLE "PartnerCustomer" ADD CONSTRAINT "PartnerCustomer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSecurity" ADD CONSTRAINT "CardSecurity_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSecurity" ADD CONSTRAINT "CardSecurity_partnerCustomerId_fkey" FOREIGN KEY ("partnerCustomerId") REFERENCES "PartnerCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

