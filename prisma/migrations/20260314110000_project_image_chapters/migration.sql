ALTER TABLE "projects_v2"
ADD COLUMN "readerConfig" JSONB;

ALTER TABLE "project_episodes"
ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "project_episodes"
DROP CONSTRAINT IF EXISTS "project_episodes_contentFormat_check";

ALTER TABLE "project_episodes"
ADD CONSTRAINT "project_episodes_contentFormat_check"
CHECK ("contentFormat" IN ('markdown', 'html', 'lexical', 'images'));

CREATE TABLE "project_episode_pages" (
  "id" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT NOT NULL,
  CONSTRAINT "project_episode_pages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_episode_pages_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "project_episodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "project_episode_pages_episodeId_position_idx"
ON "project_episode_pages" ("episodeId", "position");

CREATE TABLE "project_image_import_jobs" (
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
  CONSTRAINT "project_image_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_image_import_jobs_status_idx"
ON "project_image_import_jobs" ("status");

CREATE INDEX "project_image_import_jobs_createdAt_idx"
ON "project_image_import_jobs" ("createdAt");

CREATE INDEX "project_image_import_jobs_requestedBy_idx"
ON "project_image_import_jobs" ("requestedBy");

CREATE INDEX "project_image_import_jobs_projectId_idx"
ON "project_image_import_jobs" ("projectId");

CREATE TABLE "project_image_export_jobs" (
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
  CONSTRAINT "project_image_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_image_export_jobs_status_idx"
ON "project_image_export_jobs" ("status");

CREATE INDEX "project_image_export_jobs_createdAt_idx"
ON "project_image_export_jobs" ("createdAt");

CREATE INDEX "project_image_export_jobs_requestedBy_idx"
ON "project_image_export_jobs" ("requestedBy");

CREATE INDEX "project_image_export_jobs_projectId_idx"
ON "project_image_export_jobs" ("projectId");
