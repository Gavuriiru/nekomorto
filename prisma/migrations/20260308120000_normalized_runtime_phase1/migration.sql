-- Phase 1 of the normalized runtime migration.
-- Keeps legacy tables operational while introducing a stronger parallel schema.

ALTER TABLE "analytics_events"
ALTER COLUMN "day" TYPE DATE
USING COALESCE(NULLIF("day", '')::date, DATE("ts"));

CREATE TABLE "normalized_runtime_state" (
  "domain" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "rowCount" INTEGER NULL,
  "quarantineCount" INTEGER NOT NULL DEFAULT 0,
  "checksum" TEXT NULL,
  "data" JSONB NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "normalized_runtime_state_pkey" PRIMARY KEY ("domain"),
  CONSTRAINT "normalized_runtime_state_status_check" CHECK ("status" IN ('pending', 'ready', 'error'))
);
CREATE INDEX "normalized_runtime_state_status_idx" ON "normalized_runtime_state" ("status");

CREATE TABLE "users_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "phrase" TEXT NOT NULL,
  "bio" TEXT NOT NULL,
  "avatarUrl" TEXT NULL,
  "avatarDisplayX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "avatarDisplayY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "avatarZoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "avatarRotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "accessRole" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "users_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_v2_status_check" CHECK ("status" IN ('active', 'retired')),
  CONSTRAINT "users_v2_accessRole_check" CHECK ("accessRole" IS NULL OR "accessRole" IN ('normal', 'admin', 'owner_secondary', 'owner_primary'))
);
CREATE INDEX "users_v2_position_idx" ON "users_v2" ("position");
CREATE INDEX "users_v2_accessRole_idx" ON "users_v2" ("accessRole");
CREATE INDEX "users_v2_status_idx" ON "users_v2" ("status");

CREATE TABLE "user_social_links" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  CONSTRAINT "user_social_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_social_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_social_links_userId_position_idx" ON "user_social_links" ("userId", "position");

CREATE TABLE "user_roles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "role" TEXT NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_roles_userId_position_idx" ON "user_roles" ("userId", "position");

CREATE TABLE "user_permissions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "permission" TEXT NOT NULL,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_permissions_userId_position_idx" ON "user_permissions" ("userId", "position");

CREATE TABLE "user_favorite_works" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  CONSTRAINT "user_favorite_works_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_favorite_works_category_check" CHECK ("category" IN ('anime', 'manga')),
  CONSTRAINT "user_favorite_works_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_favorite_works_userId_category_position_idx" ON "user_favorite_works" ("userId", "category", "position");

CREATE TABLE "uploads_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NULL,
  "width" INTEGER NULL,
  "height" INTEGER NULL,
  "hashSha256" TEXT NULL,
  "altText" TEXT NOT NULL,
  "focalCrops" JSONB NULL,
  "focalPoints" JSONB NULL,
  "focalPoint" JSONB NULL,
  "variants" JSONB NULL,
  "variantsVersion" INTEGER NOT NULL DEFAULT 1,
  "variantBytes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uploads_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uploads_v2_url_key" UNIQUE ("url"),
  CONSTRAINT "uploads_v2_variantsVersion_check" CHECK ("variantsVersion" >= 1),
  CONSTRAINT "uploads_v2_variantBytes_check" CHECK ("variantBytes" >= 0)
);
CREATE INDEX "uploads_v2_position_idx" ON "uploads_v2" ("position");
CREATE INDEX "uploads_v2_folder_createdAt_idx" ON "uploads_v2" ("folder", "createdAt");
CREATE INDEX "uploads_v2_area_idx" ON "uploads_v2" ("area");
CREATE UNIQUE INDEX "uploads_v2_hashSha256_key" ON "uploads_v2" ("hashSha256") WHERE "hashSha256" IS NOT NULL AND "hashSha256" <> '';

CREATE TABLE "projects_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "anilistId" INTEGER NULL,
  "title" TEXT NOT NULL,
  "titleOriginal" TEXT NOT NULL,
  "titleEnglish" TEXT NOT NULL,
  "synopsis" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "year" TEXT NOT NULL,
  "studio" TEXT NOT NULL,
  "episodes" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cover" TEXT NOT NULL,
  "coverAlt" TEXT NOT NULL,
  "banner" TEXT NOT NULL,
  "bannerAlt" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "schedule" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "discordRoleId" TEXT NOT NULL,
  "producers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "score" DOUBLE PRECISION NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "trailerUrl" TEXT NOT NULL,
  "forceHero" BOOLEAN NOT NULL DEFAULT FALSE,
  "heroImageUrl" TEXT NOT NULL,
  "heroImageAlt" TEXT NOT NULL,
  "staff" JSONB NULL,
  "animeStaff" JSONB NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "viewsDaily" JSONB NULL,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMPTZ NULL,
  "deletedBy" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "searchText" TEXT NOT NULL,
  CONSTRAINT "projects_v2_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "projects_v2_position_idx" ON "projects_v2" ("position");
CREATE INDEX "projects_v2_deletedAt_updatedAt_idx" ON "projects_v2" ("deletedAt", "updatedAt");
CREATE INDEX "projects_v2_search_text_idx" ON "projects_v2" USING GIN (to_tsvector('simple', COALESCE("searchText", '')));

CREATE TABLE "project_relations" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "relation" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "relatedId" TEXT NULL,
  "anilistId" TEXT NULL,
  CONSTRAINT "project_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_relations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_relations_projectId_position_idx" ON "project_relations" ("projectId", "position");

CREATE TABLE "project_volume_entries" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "volume" INTEGER NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "synopsis" TEXT NOT NULL,
  "coverImageUrl" TEXT NOT NULL,
  "coverImageAlt" TEXT NOT NULL,
  CONSTRAINT "project_volume_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_volume_entries_projectId_volume_key" UNIQUE ("projectId", "volume"),
  CONSTRAINT "project_volume_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_volume_entries_projectId_position_idx" ON "project_volume_entries" ("projectId", "position");

CREATE TABLE "project_episodes" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "number" INTEGER NOT NULL,
  "volume" INTEGER NULL,
  "title" TEXT NOT NULL,
  "entryKind" TEXT NOT NULL,
  "entrySubtype" TEXT NULL,
  "readingOrder" INTEGER NULL,
  "displayLabel" TEXT NULL,
  "releaseDate" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "coverImageUrl" TEXT NULL,
  "coverImageAlt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentFormat" TEXT NOT NULL,
  "publicationStatus" TEXT NOT NULL,
  "hash" TEXT NULL,
  "sizeBytes" INTEGER NULL,
  "chapterUpdatedAt" TEXT NOT NULL,
  CONSTRAINT "project_episodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_episodes_entryKind_check" CHECK ("entryKind" IN ('main', 'extra')),
  CONSTRAINT "project_episodes_contentFormat_check" CHECK ("contentFormat" IN ('markdown', 'html', 'lexical')),
  CONSTRAINT "project_episodes_publicationStatus_check" CHECK ("publicationStatus" IN ('draft', 'published')),
  CONSTRAINT "project_episodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_episodes_projectId_position_idx" ON "project_episodes" ("projectId", "position");
CREATE INDEX "project_episodes_projectId_number_volume_idx" ON "project_episodes" ("projectId", "number", "volume");

CREATE TABLE "project_episode_sources" (
  "id" TEXT NOT NULL,
  "episodeId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  CONSTRAINT "project_episode_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_episode_sources_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "project_episodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "project_episode_sources_episodeId_position_idx" ON "project_episode_sources" ("episodeId", "position");

CREATE TABLE "posts_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "coverImageUrl" TEXT NULL,
  "coverAlt" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentFormat" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "publishedAt" TIMESTAMPTZ NULL,
  "scheduledAt" TIMESTAMPTZ NULL,
  "status" TEXT NOT NULL,
  "seoTitle" TEXT NOT NULL,
  "seoDescription" TEXT NOT NULL,
  "projectId" TEXT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "views" INTEGER NOT NULL DEFAULT 0,
  "viewsDaily" JSONB NULL,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMPTZ NULL,
  "deletedBy" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "searchText" TEXT NOT NULL,
  CONSTRAINT "posts_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "posts_v2_slug_key" UNIQUE ("slug"),
  CONSTRAINT "posts_v2_status_check" CHECK ("status" IN ('draft', 'scheduled', 'published')),
  CONSTRAINT "posts_v2_contentFormat_check" CHECK ("contentFormat" IN ('markdown', 'html', 'lexical')),
  CONSTRAINT "posts_v2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "posts_v2_position_idx" ON "posts_v2" ("position");
CREATE INDEX "posts_v2_status_publishedAt_idx" ON "posts_v2" ("status", "publishedAt" DESC);
CREATE INDEX "posts_v2_projectId_idx" ON "posts_v2" ("projectId");
CREATE INDEX "posts_v2_deletedAt_idx" ON "posts_v2" ("deletedAt");
CREATE INDEX "posts_v2_search_text_idx" ON "posts_v2" USING GIN (to_tsvector('simple', COALESCE("searchText", '')));

CREATE TABLE "post_versions_v2" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "versionNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "label" TEXT NULL,
  "actorId" TEXT NULL,
  "actorName" TEXT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "post_versions_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_versions_v2_reason_check" CHECK ("reason" IN ('create', 'update', 'manual', 'rollback')),
  CONSTRAINT "post_versions_v2_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "post_versions_v2_position_idx" ON "post_versions_v2" ("position");
CREATE INDEX "post_versions_v2_postId_createdAt_idx" ON "post_versions_v2" ("postId", "createdAt");
CREATE UNIQUE INDEX "post_versions_v2_postId_versionNumber_key" ON "post_versions_v2" ("postId", "versionNumber");

CREATE TABLE "updates_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "projectId" TEXT NOT NULL,
  "projectTitle" TEXT NOT NULL,
  "episodeNumber" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NULL,
  CONSTRAINT "updates_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "updates_v2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "updates_v2_position_idx" ON "updates_v2" ("position");
CREATE INDEX "updates_v2_projectId_updatedAt_idx" ON "updates_v2" ("projectId", "updatedAt" DESC);

CREATE TABLE "comments_v2" (
  "id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "postId" TEXT NULL,
  "projectId" TEXT NULL,
  "episodeId" TEXT NULL,
  "parentId" TEXT NULL,
  "name" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "avatarUrl" TEXT NOT NULL,
  "approvedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NULL,
  "targetMeta" JSONB NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "comments_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_v2_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "comments_v2_targetType_check" CHECK ("targetType" IN ('post', 'project', 'chapter')),
  CONSTRAINT "comments_v2_single_target_check" CHECK (
    (CASE WHEN "postId" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "projectId" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "episodeId" IS NULL THEN 0 ELSE 1 END) = 1
  ),
  CONSTRAINT "comments_v2_target_match_check" CHECK (
    ("targetType" = 'post' AND "postId" IS NOT NULL AND "projectId" IS NULL AND "episodeId" IS NULL) OR
    ("targetType" = 'project' AND "postId" IS NULL AND "projectId" IS NOT NULL AND "episodeId" IS NULL) OR
    ("targetType" = 'chapter' AND "postId" IS NULL AND "projectId" IS NULL AND "episodeId" IS NOT NULL)
  ),
  CONSTRAINT "comments_v2_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_v2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects_v2" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_v2_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "project_episodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "comments_v2_position_idx" ON "comments_v2" ("position");
CREATE INDEX "comments_v2_status_createdAt_idx" ON "comments_v2" ("status", "createdAt" DESC);
CREATE INDEX "comments_v2_postId_idx" ON "comments_v2" ("postId");
CREATE INDEX "comments_v2_projectId_idx" ON "comments_v2" ("projectId");
CREATE INDEX "comments_v2_episodeId_idx" ON "comments_v2" ("episodeId");

DELETE FROM "owner_ids"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "allowed_users"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "user_mfa_totp"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "user_session_index"
WHERE "userId" NOT IN (SELECT "id" FROM "users");

DELETE FROM "user_session_index"
WHERE "sid" NOT IN (SELECT "sid" FROM "user_sessions");

ALTER TABLE "owner_ids"
ADD CONSTRAINT "owner_ids_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "allowed_users"
ADD CONSTRAINT "allowed_users_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_mfa_totp"
ADD CONSTRAINT "user_mfa_totp_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_session_index"
ADD CONSTRAINT "user_session_index_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_session_index"
ADD CONSTRAINT "user_session_index_sid_fkey"
FOREIGN KEY ("sid") REFERENCES "user_sessions" ("sid") ON DELETE CASCADE ON UPDATE CASCADE;
