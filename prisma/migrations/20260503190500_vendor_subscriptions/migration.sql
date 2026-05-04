CREATE TYPE "SubscriptionPlanKey" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');
CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "VendorSubscriptionStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'UNPAID'
);

CREATE TABLE "VendorSubscription" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "planKey" "SubscriptionPlanKey" NOT NULL,
  "billingInterval" "SubscriptionBillingInterval" NOT NULL,
  "status" "VendorSubscriptionStatus" NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "stripePriceId" TEXT,
  "stripeProductId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "trialStart" TIMESTAMP(3),
  "trialEnd" TIMESTAMP(3),
  "transactionsUsed" INTEGER NOT NULL DEFAULT 0,
  "eSignaturesUsed" INTEGER NOT NULL DEFAULT 0,
  "kycVerificationsUsed" INTEGER NOT NULL DEFAULT 0,
  "qrCodesUsed" INTEGER NOT NULL DEFAULT 0,
  "smsWhatsappUsed" INTEGER NOT NULL DEFAULT 0,
  "teamUsersUsed" INTEGER NOT NULL DEFAULT 0,
  "usagePeriodStart" TIMESTAMP(3),
  "usagePeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VendorSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorSubscription_vendorId_key" ON "VendorSubscription"("vendorId");
CREATE UNIQUE INDEX "VendorSubscription_stripeCustomerId_key" ON "VendorSubscription"("stripeCustomerId");
CREATE UNIQUE INDEX "VendorSubscription_stripeSubscriptionId_key" ON "VendorSubscription"("stripeSubscriptionId");
CREATE INDEX "VendorSubscription_status_currentPeriodEnd_idx" ON "VendorSubscription"("status", "currentPeriodEnd");
CREATE INDEX "VendorSubscription_planKey_billingInterval_idx" ON "VendorSubscription"("planKey", "billingInterval");

ALTER TABLE "VendorSubscription"
ADD CONSTRAINT "VendorSubscription_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
