ALTER TABLE "projects_v2"
ADD COLUMN "animationStudios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
