-- AlterTable
ALTER TABLE "VendorProfile"
ADD COLUMN "businessLogoFileName" TEXT,
ADD COLUMN "businessLogoPublicId" TEXT,
ADD COLUMN "businessLogoUrl" TEXT;

-- Backfill any vendor logos that were previously written into User.image
UPDATE "VendorProfile" AS vp
SET
  "businessLogoUrl" = u."image",
  "businessLogoPublicId" = regexp_replace(
    regexp_replace(u."image", '^.*?/image/upload/(?:v[0-9]+/)?', ''),
    '\.[^.\/?]+(?:\?.*)?$', ''
  ),
  "businessLogoFileName" = regexp_replace(
    regexp_replace(u."image", '^.*\/', ''),
    '\?.*$', ''
  )
FROM "User" AS u
WHERE u."id" = vp."userId"
  AND vp."businessLogoUrl" IS NULL
  AND u."image" IS NOT NULL
  AND u."image" LIKE '%/conntrazy/vendor-logos/%';
