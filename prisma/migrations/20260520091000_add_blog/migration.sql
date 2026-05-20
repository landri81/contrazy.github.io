CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "authorId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "coverUrl" TEXT,
  "coverPublicId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPostLocale" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "locale" "LocaleCode" NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "contentHtml" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDesc" TEXT,
  "coverAlt" TEXT,
  "category" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BlogPostLocale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogMedia" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "publicId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BlogMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlogPost_status_publishedAt_idx"
ON "BlogPost"("status", "publishedAt");

CREATE UNIQUE INDEX "BlogPostLocale_postId_locale_key"
ON "BlogPostLocale"("postId", "locale");

CREATE UNIQUE INDEX "BlogPostLocale_locale_slug_key"
ON "BlogPostLocale"("locale", "slug");

CREATE INDEX "BlogPostLocale_locale_postId_idx"
ON "BlogPostLocale"("locale", "postId");

CREATE UNIQUE INDEX "BlogMedia_publicId_key"
ON "BlogMedia"("publicId");

ALTER TABLE "BlogPost"
ADD CONSTRAINT "BlogPost_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BlogPostLocale"
ADD CONSTRAINT "BlogPostLocale_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlogMedia"
ADD CONSTRAINT "BlogMedia_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
