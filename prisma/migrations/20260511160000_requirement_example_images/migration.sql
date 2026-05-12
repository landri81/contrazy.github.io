-- AlterTable
ALTER TABLE "ChecklistItem"
ADD COLUMN "exampleImageFileName" TEXT,
ADD COLUMN "exampleImagePublicId" TEXT,
ADD COLUMN "exampleImageUrl" TEXT;

-- AlterTable
ALTER TABLE "TransactionRequirement"
ADD COLUMN "exampleImageFileName" TEXT,
ADD COLUMN "exampleImagePublicId" TEXT,
ADD COLUMN "exampleImageUrl" TEXT;
