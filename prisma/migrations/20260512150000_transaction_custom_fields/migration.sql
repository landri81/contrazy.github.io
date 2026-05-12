CREATE TYPE "TransactionCustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT');

ALTER TYPE "TransactionEventType" ADD VALUE IF NOT EXISTS 'CUSTOM_FIELDS_SUBMITTED';

CREATE TABLE "TransactionCustomField" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "type" "TransactionCustomFieldType" NOT NULL DEFAULT 'TEXT',
    "selectOptions" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransactionCustomField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionCustomFieldResponse" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionCustomFieldResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCustomFieldResponse_customFieldId_key" ON "TransactionCustomFieldResponse"("customFieldId");
CREATE INDEX "TransactionCustomFieldResponse_transactionId_answeredAt_idx" ON "TransactionCustomFieldResponse"("transactionId", "answeredAt");

ALTER TABLE "TransactionCustomField"
ADD CONSTRAINT "TransactionCustomField_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionCustomFieldResponse"
ADD CONSTRAINT "TransactionCustomFieldResponse_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionCustomFieldResponse"
ADD CONSTRAINT "TransactionCustomFieldResponse_customFieldId_fkey"
FOREIGN KEY ("customFieldId") REFERENCES "TransactionCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
