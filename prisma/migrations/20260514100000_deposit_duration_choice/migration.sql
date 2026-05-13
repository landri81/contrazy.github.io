ALTER TABLE "Transaction"
ADD COLUMN "depositHoldDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "depositLongTermStripeFeeEstimateAmount" INTEGER,
ADD COLUMN "depositLongTermPlatformFeeAmount" INTEGER,
ADD COLUMN "depositLongTermFeeAcceptedAt" TIMESTAMP(3);

