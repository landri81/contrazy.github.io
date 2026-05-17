ALTER TABLE "ClientProfile"
ADD COLUMN "birthCity" TEXT,
ADD COLUMN "birthDate" DATE;

ALTER TABLE "Transaction"
ADD COLUMN "signatureCity" TEXT,
ADD COLUMN "serviceDate" DATE;
