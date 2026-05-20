DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ContactMessageStatus'
  ) THEN
    CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DISPUTE_OPENED'
      AND enumtypid = '"TransactionEventType"'::regtype
  ) THEN
    ALTER TYPE "TransactionEventType" ADD VALUE 'DISPUTE_OPENED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'TRANSACTION_CANCELLED'
      AND enumtypid = '"TransactionEventType"'::regtype
  ) THEN
    ALTER TYPE "TransactionEventType" ADD VALUE 'TRANSACTION_CANCELLED';
  END IF;
END $$;

ALTER TABLE "Dispute"
ADD COLUMN IF NOT EXISTS "evidenceImages" JSONB,
ADD COLUMN IF NOT EXISTS "resolution" TEXT,
ADD COLUMN IF NOT EXISTS "resolvedByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "Dispute_status_openedAt_idx"
ON "Dispute"("status", "openedAt");

CREATE TABLE IF NOT EXISTS "ContactMessage" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "locale" "LocaleCode" NOT NULL DEFAULT 'en',
  "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
  "repliedAt" TIMESTAMP(3),
  "replyText" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactMessage_status_createdAt_idx"
ON "ContactMessage"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ContactMessage_email_idx"
ON "ContactMessage"("email");
