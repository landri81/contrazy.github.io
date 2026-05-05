ALTER TYPE "TransactionEventType" ADD VALUE 'CONTRACT_SNAPSHOT_CREATED';
ALTER TYPE "TransactionEventType" ADD VALUE 'SIGNED_PDF_GENERATED';

ALTER TABLE "VendorProfile"
    ADD COLUMN "ownerFirstName" TEXT,
    ADD COLUMN "ownerLastName" TEXT,
    ADD COLUMN "registrationNumber" TEXT,
    ADD COLUMN "vatNumber" TEXT;

ALTER TABLE "ClientProfile"
    ADD COLUMN "firstName" TEXT,
    ADD COLUMN "lastName" TEXT,
    ADD COLUMN "address" TEXT,
    ADD COLUMN "country" TEXT;

CREATE TABLE "TransactionContractArtifact" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "sourceTemplateName" TEXT,
    "sourceTemplateDescription" TEXT,
    "templateContentSnapshot" TEXT,
    "renderedContentBeforeSignature" TEXT,
    "renderedContentAfterSignature" TEXT,
    "signatureImageUrl" TEXT,
    "signatureImagePublicId" TEXT,
    "signedPdfUrl" TEXT,
    "signedPdfPublicId" TEXT,
    "signedPdfHash" TEXT,
    "reviewCompletedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "signedTimezone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionContractArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionContractArtifact_transactionId_key" ON "TransactionContractArtifact"("transactionId");
CREATE INDEX "TransactionContractArtifact_signedAt_idx" ON "TransactionContractArtifact"("signedAt");

ALTER TABLE "TransactionContractArtifact" ADD CONSTRAINT "TransactionContractArtifact_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
