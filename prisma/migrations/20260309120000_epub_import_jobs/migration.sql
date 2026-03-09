CREATE TABLE "epub_import_jobs" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "resultPath" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "epub_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "epub_import_jobs_status_idx" ON "epub_import_jobs"("status");
CREATE INDEX "epub_import_jobs_createdAt_idx" ON "epub_import_jobs"("createdAt");
CREATE INDEX "epub_import_jobs_requestedBy_idx" ON "epub_import_jobs"("requestedBy");
CREATE INDEX "epub_import_jobs_projectId_idx" ON "epub_import_jobs"("projectId");
