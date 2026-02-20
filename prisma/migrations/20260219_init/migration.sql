-- Initial relational bootstrap for JSON -> DB migration
-- Generated manually for PostgreSQL

CREATE TABLE "posts" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "slug" TEXT NOT NULL,
  "projectId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMPTZ NULL,
  "deletedAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "posts_slug_key" UNIQUE ("slug")
);
CREATE INDEX "posts_position_idx" ON "posts" ("position");
CREATE INDEX "posts_status_idx" ON "posts" ("status");

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "projects_position_idx" ON "projects" ("position");

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "accessRole" TEXT NULL,
  "status" TEXT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "users_position_idx" ON "users" ("position");
CREATE INDEX "users_accessRole_idx" ON "users" ("accessRole");

CREATE TABLE "comments" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comments_position_idx" ON "comments" ("position");
CREATE INDEX "comments_targetType_targetId_idx" ON "comments" ("targetType", "targetId");

CREATE TABLE "updates" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "projectId" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "updates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "updates_position_idx" ON "updates" ("position");
CREATE INDEX "updates_projectId_idx" ON "updates" ("projectId");

CREATE TABLE "uploads" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uploads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uploads_url_key" UNIQUE ("url")
);
CREATE INDEX "uploads_position_idx" ON "uploads" ("position");
CREATE INDEX "uploads_folder_idx" ON "uploads" ("folder");

CREATE TABLE "link_types" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "link_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "link_types_position_idx" ON "link_types" ("position");

CREATE TABLE "owner_ids" (
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "owner_ids_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "owner_ids_position_key" UNIQUE ("position")
);
CREATE INDEX "owner_ids_position_idx" ON "owner_ids" ("position");

CREATE TABLE "allowed_users" (
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "allowed_users_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "allowed_users_position_idx" ON "allowed_users" ("position");

CREATE TABLE "site_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pages" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tag_translations" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tag_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "ts" TIMESTAMPTZ NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT NULL,
  "status" TEXT NOT NULL,
  "requestId" TEXT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_position_idx" ON "audit_logs" ("position");
CREATE INDEX "audit_logs_ts_idx" ON "audit_logs" ("ts");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");

CREATE TABLE "analytics_events" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "ts" TIMESTAMPTZ NOT NULL,
  "day" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "referrerHost" TEXT NOT NULL,
  "isAuthenticated" BOOLEAN NOT NULL DEFAULT FALSE,
  "data" JSONB NOT NULL,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_events_position_idx" ON "analytics_events" ("position");
CREATE INDEX "analytics_events_day_idx" ON "analytics_events" ("day");
CREATE INDEX "analytics_events_resourceType_resourceId_idx" ON "analytics_events" ("resourceType", "resourceId");
CREATE INDEX "analytics_events_ts_idx" ON "analytics_events" ("ts");

CREATE TABLE "analytics_daily" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "schemaVersion" INTEGER NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_meta" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "schemaVersion" INTEGER NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "aggregateRetentionDays" INTEGER NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "analytics_meta_pkey" PRIMARY KEY ("id")
);
