-- New enums for Check-In / Check-Out flow
CREATE TYPE "TransactionFlowType" AS ENUM ('STANDARD', 'CHECK_IN_OUT');
CREATE TYPE "TransactionReportType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
CREATE TYPE "TransactionReportStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SIGNED');
CREATE TYPE "TransactionReportFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT');

-- New event types
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'CHECK_IN_SUBMITTED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'CHECK_OUT_REQUESTED';
ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'CHECK_OUT_SUBMITTED';

-- New columns on Transaction
ALTER TABLE "Transaction" ADD COLUMN "flowType" "TransactionFlowType" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Transaction" ADD COLUMN "checkOutRequestedAt" TIMESTAMP(3);

-- TransactionReportField table
CREATE TABLE "TransactionReportField" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reportType" "TransactionReportType" NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "fieldType" "TransactionReportFieldType" NOT NULL DEFAULT 'TEXT',
    "selectOptions" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransactionReportField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionReportField_transactionId_reportType_idx" ON "TransactionReportField"("transactionId", "reportType");

ALTER TABLE "TransactionReportField"
ADD CONSTRAINT "TransactionReportField_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TransactionReport table
CREATE TABLE "TransactionReport" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" "TransactionReportType" NOT NULL,
    "status" "TransactionReportStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "artifactHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionReport_transactionId_type_key" ON "TransactionReport"("transactionId", "type");
CREATE INDEX "TransactionReport_transactionId_idx" ON "TransactionReport"("transactionId");

ALTER TABLE "TransactionReport"
ADD CONSTRAINT "TransactionReport_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TransactionReportResponse table
CREATE TABLE "TransactionReportResponse" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "TransactionReportResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionReportResponse_reportId_fieldId_key" ON "TransactionReportResponse"("reportId", "fieldId");

ALTER TABLE "TransactionReportResponse"
ADD CONSTRAINT "TransactionReportResponse_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "TransactionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionReportResponse"
ADD CONSTRAINT "TransactionReportResponse_fieldId_fkey"
FOREIGN KEY ("fieldId") REFERENCES "TransactionReportField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TransactionReportAsset table
CREATE TABLE "TransactionReportAsset" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransactionReportAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionReportAsset_reportId_idx" ON "TransactionReportAsset"("reportId");

ALTER TABLE "TransactionReportAsset"
ADD CONSTRAINT "TransactionReportAsset_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "TransactionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
