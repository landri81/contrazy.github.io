-- AlterTable
ALTER TABLE "VendorSubscription" ADD COLUMN     "partnerGrantedAt" TIMESTAMP(3),
ADD COLUMN     "partnerGrantedBy" TEXT,
ADD COLUMN     "partnerNote" TEXT,
ADD COLUMN     "partnerPlan" BOOLEAN NOT NULL DEFAULT false;
