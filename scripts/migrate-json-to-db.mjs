import { spawnSync } from "child_process";
import path from "path";
import { prisma } from "../server/lib/prisma-client.js";
import {
  applyUploadBackfill,
  backfillMissingUploads,
  checksumOf,
  loadSnapshotFromJson,
  normalizeSnapshot,
  rootDir,
  snapshotCounts,
} from "./lib/db-migration-utils.mjs";

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const isDryRun = !shouldApply || args.has("--dry-run");
const failOnMissingUploadFiles = args.has("--fail-on-missing-upload-files");

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const runPreValidation = () => {
  const validateScriptPath = path.join(rootDir, "scripts", "validate-data.mjs");
  const result = spawnSync(process.execPath, [validateScriptPath], {
    cwd: rootDir,
    encoding: "utf-8",
  });
  if (result.stdout?.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
  if (result.status !== 0) {
    throw new Error("Preflight validation failed (scripts/validate-data.mjs)");
  }
};

const syncRowsByPk = async ({ modelName, pk, rows }) => {
  const model = prisma[modelName];
  if (!model) {
    throw new Error(`Unknown Prisma model delegate: ${modelName}`);
  }
  const existingRows = await model.findMany({
    select: {
      [pk]: true,
    },
  });
  const nextIds = new Set(rows.map((row) => String(row[pk])));
  for (const row of rows) {
    const pkValue = row[pk];
    await model.upsert({
      where: { [pk]: pkValue },
      create: row,
      update: row,
    });
  }
  const staleIds = existingRows
    .map((item) => String(item[pk]))
    .filter((id) => !nextIds.has(id));
  if (staleIds.length > 0) {
    await model.deleteMany({
      where: {
        [pk]: {
          in: staleIds,
        },
      },
    });
  }
};

const upsertSingleton = async ({ modelName, id, payload }) => {
  const model = prisma[modelName];
  if (!model) {
    throw new Error(`Unknown Prisma model delegate: ${modelName}`);
  }
  await model.upsert({
    where: { id },
    create: {
      id,
      ...payload,
    },
    update: payload,
  });
};

const buildDbRows = (snapshot) => ({
  posts: snapshot.posts.map((post, index) => ({
    id: String(post?.id || `post-${index}`),
    position: index,
    slug: String(post?.slug || post?.id || `post-${index}`),
    projectId: String(post?.projectId || ""),
    status: String(post?.status || "draft"),
    publishedAt: toDateOrNull(post?.publishedAt),
    deletedAt: toDateOrNull(post?.deletedAt),
    data: post,
  })),
  projects: snapshot.projects.map((project, index) => ({
    id: String(project?.id || `project-${index}`),
    position: index,
    deletedAt: toDateOrNull(project?.deletedAt),
    data: project,
  })),
  users: snapshot.users.map((user, index) => ({
    id: String(user?.id || `user-${index}`),
    position: index,
    accessRole: user?.accessRole ? String(user.accessRole) : null,
    status: user?.status ? String(user.status) : null,
    data: user,
  })),
  comments: snapshot.comments.map((comment, index) => ({
    id: String(comment?.id || `comment-${index}`),
    position: index,
    targetType: String(comment?.targetType || ""),
    targetId: String(comment?.targetId || ""),
    status: String(comment?.status || "pending"),
    createdAt: toDateOrNull(comment?.createdAt),
    data: comment,
  })),
  updates: snapshot.updates.map((update, index) => ({
    id: String(update?.id || `update-${index}`),
    position: index,
    projectId: String(update?.projectId || ""),
    updatedAt: toDateOrNull(update?.updatedAt),
    data: update,
  })),
  uploads: snapshot.uploads.map((upload, index) => ({
    id: String(upload?.id || `upload-${index}`),
    position: index,
    url: String(upload?.url || ""),
    folder: String(upload?.folder || ""),
    createdAt: toDateOrNull(upload?.createdAt),
    data: upload,
  })),
  linkTypes: snapshot.linkTypes.map((item, index) => ({
    id: String(item?.id || `link-type-${index}`),
    position: index,
    label: String(item?.label || ""),
    icon: String(item?.icon || ""),
    data: item,
  })),
  ownerIds: snapshot.ownerIds.map((userId, index) => ({
    userId: String(userId),
    position: index,
  })),
  allowedUsers: snapshot.allowedUsers.map((userId, index) => ({
    userId: String(userId),
    position: index,
  })),
  auditLogs: snapshot.auditLog.map((entry, index) => ({
    id: String(entry?.id || `audit-${index}`),
    position: index,
    ts: toDateOrNull(entry?.ts) || new Date(),
    actorId: String(entry?.actorId || "anonymous"),
    actorName: String(entry?.actorName || "anonymous"),
    ip: String(entry?.ip || ""),
    action: String(entry?.action || ""),
    resource: String(entry?.resource || ""),
    resourceId: entry?.resourceId ? String(entry.resourceId) : null,
    status: String(entry?.status || "success"),
    requestId: entry?.requestId ? String(entry.requestId) : null,
    data: entry,
  })),
  analyticsEvents: snapshot.analyticsEvents.map((event, index) => ({
    id: String(event?.id || `analytics-event-${index}`),
    position: index,
    ts: toDateOrNull(event?.ts) || new Date(),
    day: String(event?.day || ""),
    eventType: String(event?.eventType || "view"),
    resourceType: String(event?.resourceType || "post"),
    resourceId: String(event?.resourceId || ""),
    visitorHash: String(event?.visitorHash || "anonymous"),
    referrerHost: String(event?.referrerHost || "(direct)"),
    isAuthenticated: Boolean(event?.isAuthenticated),
    data: event,
  })),
});

const persistSnapshot = async (snapshot) => {
  const rows = buildDbRows(snapshot);

  await syncRowsByPk({ modelName: "postRecord", pk: "id", rows: rows.posts });
  await syncRowsByPk({ modelName: "projectRecord", pk: "id", rows: rows.projects });
  await syncRowsByPk({ modelName: "userRecord", pk: "id", rows: rows.users });
  await syncRowsByPk({ modelName: "commentRecord", pk: "id", rows: rows.comments });
  await syncRowsByPk({ modelName: "updateRecord", pk: "id", rows: rows.updates });
  await syncRowsByPk({ modelName: "uploadRecord", pk: "id", rows: rows.uploads });
  await syncRowsByPk({ modelName: "linkTypeRecord", pk: "id", rows: rows.linkTypes });
  await syncRowsByPk({ modelName: "ownerIdRecord", pk: "userId", rows: rows.ownerIds });
  await syncRowsByPk({ modelName: "allowedUserRecord", pk: "userId", rows: rows.allowedUsers });
  await syncRowsByPk({ modelName: "auditLogRecord", pk: "id", rows: rows.auditLogs });
  await syncRowsByPk({ modelName: "analyticsEventRecord", pk: "id", rows: rows.analyticsEvents });

  await upsertSingleton({
    modelName: "siteSettingsRecord",
    id: 1,
    payload: {
      data: snapshot.siteSettings,
    },
  });
  await upsertSingleton({
    modelName: "pagesRecord",
    id: 1,
    payload: {
      data: snapshot.pages,
    },
  });
  await upsertSingleton({
    modelName: "tagTranslationsRecord",
    id: 1,
    payload: {
      data: snapshot.tagTranslations,
    },
  });
  await upsertSingleton({
    modelName: "analyticsDailyRecord",
    id: 1,
    payload: {
      schemaVersion: Number(snapshot.analyticsDaily?.schemaVersion || 1),
      generatedAt: toDateOrNull(snapshot.analyticsDaily?.generatedAt) || new Date(),
      data: snapshot.analyticsDaily,
    },
  });
  await upsertSingleton({
    modelName: "analyticsMetaRecord",
    id: 1,
    payload: {
      schemaVersion: Number(snapshot.analyticsMeta?.schemaVersion || 1),
      retentionDays: Number(snapshot.analyticsMeta?.retentionDays || 90),
      aggregateRetentionDays: Number(snapshot.analyticsMeta?.aggregateRetentionDays || 365),
      updatedAt: toDateOrNull(snapshot.analyticsMeta?.updatedAt) || new Date(),
      data: snapshot.analyticsMeta,
    },
  });
};

const main = async () => {
  if (shouldApply && !String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("DATABASE_URL is required for --apply");
  }

  runPreValidation();

  let snapshot = loadSnapshotFromJson();
  snapshot = normalizeSnapshot(snapshot);

  const backfill = backfillMissingUploads(snapshot);
  snapshot = applyUploadBackfill(snapshot, backfill);

  const report = {
    mode: isDryRun ? "dry-run" : "apply",
    ts: new Date().toISOString(),
    counts: snapshotCounts(snapshot),
    checksums: {
      posts: checksumOf(snapshot.posts),
      projects: checksumOf(snapshot.projects),
      users: checksumOf(snapshot.users),
      comments: checksumOf(snapshot.comments),
      updates: checksumOf(snapshot.updates),
      uploads: checksumOf(snapshot.uploads),
      pages: checksumOf(snapshot.pages),
      siteSettings: checksumOf(snapshot.siteSettings),
      tagTranslations: checksumOf(snapshot.tagTranslations),
      linkTypes: checksumOf(snapshot.linkTypes),
      ownerIds: checksumOf(snapshot.ownerIds),
      allowedUsers: checksumOf(snapshot.allowedUsers),
      auditLog: checksumOf(snapshot.auditLog),
      analyticsEvents: checksumOf(snapshot.analyticsEvents),
      analyticsDaily: checksumOf(snapshot.analyticsDaily),
      analyticsMeta: checksumOf(snapshot.analyticsMeta),
    },
    uploadBackfill: {
      added: backfill.added.length,
      missingOnDisk: backfill.missingOnDisk.length,
      missingOnDiskUrls: backfill.missingOnDisk,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (failOnMissingUploadFiles && backfill.missingOnDisk.length > 0) {
    throw new Error(
      `Missing upload files for ${backfill.missingOnDisk.length} referenced URLs`,
    );
  }

  if (isDryRun) {
    return;
  }

  await persistSnapshot(snapshot);

  console.log("JSON snapshot persisted to DB successfully.");
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
