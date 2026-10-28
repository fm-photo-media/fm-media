-- Batch 3 (review fixes): admin sessions (SEC-2), named counters (SEC-19) and an index
-- for the paged, newest-first inquiry list (SEC-13). Additive only: nothing is dropped or
-- rewritten, so the live site keeps running while this applies. Old admin cookies stop
-- working once the new code is deployed (they match no AdminSession row): sign in again.

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Inquiry_createdAt_idx" ON "Inquiry"("createdAt");

