-- AlterTable
ALTER TABLE "analytics_daily" ALTER COLUMN "generatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "analytics_events" ALTER COLUMN "ts" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "analytics_meta" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "ts" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "comments" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "link_types" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pages" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "publishedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tag_translations" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "updates" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "uploads" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_preferences" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "post_versions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "versionNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "label" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_versions_position_idx" ON "post_versions"("position");

-- CreateIndex
CREATE INDEX "post_versions_postId_createdAt_idx" ON "post_versions"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "post_versions_postId_versionNumber_idx" ON "post_versions"("postId", "versionNumber");
