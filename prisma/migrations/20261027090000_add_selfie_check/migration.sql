-- C4: selfie option in identity checks (additive only)

-- CreateEnum
CREATE TYPE "KycSelfieCheck" AS ENUM ('NOT_REQUESTED', 'VERIFIED', 'UNVERIFIED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "requireSelfie" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "KycVerification" ADD COLUMN     "selfieCheck" "KycSelfieCheck" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "selfieErrorCode" TEXT;
