-- AlterTable
ALTER TABLE "SignatureRecord" ADD COLUMN     "signatureDataUrl" TEXT,
ALTER COLUMN "method" SET DEFAULT 'Canvas Signature';
