-- Promote webhook logs from JSON-only records to queryable, vendor-visible records.
ALTER TABLE "WebhookEvent" ADD COLUMN "providerEventId" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "transactionId" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "error" TEXT;

UPDATE "WebhookEvent"
SET
  "providerEventId" = NULLIF("payload"->>'id', ''),
  "transactionId" = NULLIF("payload"->>'transactionId', ''),
  "error" = NULLIF("payload"->>'error', '')
WHERE "payload" IS NOT NULL;

UPDATE "WebhookEvent" AS webhook
SET "vendorId" = transaction."vendorId"
FROM "Transaction" AS transaction
WHERE webhook."vendorId" IS NULL
  AND webhook."transactionId" = transaction."id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "provider", "providerEventId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "WebhookEvent"
  WHERE "providerEventId" IS NOT NULL
)
UPDATE "WebhookEvent" AS webhook
SET "providerEventId" = NULL
FROM ranked
WHERE webhook."id" = ranked."id"
  AND ranked.rn > 1;

CREATE INDEX "WebhookEvent_vendorId_createdAt_idx" ON "WebhookEvent"("vendorId", "createdAt");
CREATE INDEX "WebhookEvent_transactionId_idx" ON "WebhookEvent"("transactionId");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

ALTER TABLE "WebhookEvent"
ADD CONSTRAINT "WebhookEvent_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
