-- CreateTable
CREATE TABLE "EmailRetryQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactSubmissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRunAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailRetryQueue_contactSubmissionId_fkey" FOREIGN KEY ("contactSubmissionId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailRetryQueue_status_nextRunAt_idx" ON "EmailRetryQueue"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRetryQueue_contactSubmissionId_kind_key" ON "EmailRetryQueue"("contactSubmissionId", "kind");
