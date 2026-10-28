-- Batch 2 (review fixes): booking reliability. Additive only: no column is dropped
-- or rewritten, so the site that is live now keeps working while this applies.

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "preferredWindow" TEXT NOT NULL DEFAULT 'Flexible',
ADD COLUMN     "submissionKey" TEXT;

-- Rows saved before this migration: nobody knows whether their email went out.
UPDATE "Inquiry" SET "emailStatus" = 'UNKNOWN';

-- CreateTable
CREATE TABLE "RateLimitAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_submissionKey_key" ON "Inquiry"("submissionKey");

-- CreateIndex
CREATE INDEX "RateLimitAttempt_key_createdAt_idx" ON "RateLimitAttempt"("key", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitAttempt_createdAt_idx" ON "RateLimitAttempt"("createdAt");
