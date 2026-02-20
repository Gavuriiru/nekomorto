import { prisma } from "../server/lib/prisma-client.js";
import {
  applyUploadBackfill,
  backfillMissingUploads,
  checksumOf,
  loadSnapshotFromJson,
  normalizeSnapshot,
  snapshotCounts,
} from "./lib/db-migration-utils.mjs";

const args = new Set(process.argv.slice(2));
const skipUploadBackfill = args.has("--skip-upload-backfill");

const buildDbSnapshot = async () => {
  const [
    posts,
    projects,
    users,
    comments,
    updates,
    uploads,
    linkTypes,
    ownerIds,
    allowedUsers,
    auditLog,
    analyticsEvents,
    pages,
    siteSettings,
    tagTranslations,
    analyticsDaily,
    analyticsMeta,
  ] = await Promise.all([
    prisma.postRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.projectRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.userRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.commentRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.updateRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.uploadRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.linkTypeRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.ownerIdRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.allowedUserRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.auditLogRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.analyticsEventRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.pagesRecord.findUnique({ where: { id: 1 } }),
    prisma.siteSettingsRecord.findUnique({ where: { id: 1 } }),
    prisma.tagTranslationsRecord.findUnique({ where: { id: 1 } }),
    prisma.analyticsDailyRecord.findUnique({ where: { id: 1 } }),
    prisma.analyticsMetaRecord.findUnique({ where: { id: 1 } }),
  ]);

  return normalizeSnapshot({
    posts: posts.map((row) => row.data),
    projects: projects.map((row) => row.data),
    users: users.map((row) => row.data),
    comments: comments.map((row) => row.data),
    updates: updates.map((row) => row.data),
    uploads: uploads.map((row) => row.data),
    linkTypes: linkTypes.map((row) => row.data),
    ownerIds: ownerIds.map((row) => row.userId),
    allowedUsers: allowedUsers.map((row) => row.userId),
    auditLog: auditLog.map((row) => row.data),
    analyticsEvents: analyticsEvents.map((row) => row.data),
    pages: pages?.data || {},
    siteSettings: siteSettings?.data || {},
    tagTranslations: tagTranslations?.data || { tags: {}, genres: {}, staffRoles: {} },
    analyticsDaily: analyticsDaily?.data || { schemaVersion: 1, generatedAt: new Date().toISOString(), days: {} },
    analyticsMeta: analyticsMeta?.data || {
      schemaVersion: 1,
      retentionDays: 90,
      aggregateRetentionDays: 365,
      updatedAt: new Date().toISOString(),
    },
  });
};

const buildComparison = (left, right) => {
  const keys = [
    "posts",
    "projects",
    "users",
    "comments",
    "updates",
    "uploads",
    "pages",
    "siteSettings",
    "tagTranslations",
    "linkTypes",
    "ownerIds",
    "allowedUsers",
    "auditLog",
    "analyticsEvents",
    "analyticsDaily",
    "analyticsMeta",
  ];
  const differences = [];
  keys.forEach((key) => {
    const leftChecksum = checksumOf(left[key]);
    const rightChecksum = checksumOf(right[key]);
    if (leftChecksum !== rightChecksum) {
      differences.push({
        key,
        expected: leftChecksum,
        actual: rightChecksum,
      });
    }
  });
  return differences;
};

const main = async () => {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("DATABASE_URL is required");
  }

  let expected = normalizeSnapshot(loadSnapshotFromJson());
  if (!skipUploadBackfill) {
    expected = applyUploadBackfill(expected, backfillMissingUploads(expected));
  }

  const actual = await buildDbSnapshot();
  const expectedCounts = snapshotCounts(expected);
  const actualCounts = snapshotCounts(actual);
  const differences = buildComparison(expected, actual);

  console.log(
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        expectedCounts,
        actualCounts,
        differences,
      },
      null,
      2,
    ),
  );

  if (differences.length > 0) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore disconnect failure
    }
  });
