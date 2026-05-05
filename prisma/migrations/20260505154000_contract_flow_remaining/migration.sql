CREATE TYPE "PaymentCollectionTiming" AS ENUM ('AFTER_SIGNING', 'AFTER_SERVICE');
CREATE TYPE "RequirementCategory" AS ENUM (
    'ID',
    'PROOF_OF_ADDRESS',
    'DRIVER_LICENSE',
    'COMPANY_REGISTRATION',
    'CONTRACT_ATTACHMENT',
    'CUSTOM',
    'OTHER'
);

ALTER TYPE "TransactionEventType" ADD VALUE 'SERVICE_PAYMENT_REQUESTED';

ALTER TABLE "ChecklistItem"
    ADD COLUMN "category" "RequirementCategory" NOT NULL DEFAULT 'CUSTOM',
    ADD COLUMN "customCategoryLabel" TEXT;

ALTER TABLE "Transaction"
    ADD COLUMN "paymentCollectionTiming" "PaymentCollectionTiming" NOT NULL DEFAULT 'AFTER_SIGNING',
    ADD COLUMN "requireClientCompany" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "servicePaymentRequestedAt" TIMESTAMP(3),
    ADD COLUMN "customerCompletedAt" TIMESTAMP(3);

ALTER TABLE "TransactionRequirement"
    ADD COLUMN "category" "RequirementCategory" NOT NULL DEFAULT 'CUSTOM',
    ADD COLUMN "customCategoryLabel" TEXT,
    ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DocumentAsset"
    ALTER COLUMN "assetUrl" DROP NOT NULL,
    ADD COLUMN "textValue" TEXT;

ALTER TABLE "Payment"
    ADD COLUMN "stripeFeeAmount" INTEGER,
    ADD COLUMN "platformFeeAmount" INTEGER,
    ADD COLUMN "vendorNetAmount" INTEGER;
