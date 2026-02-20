import crypto from "crypto";
import { prisma as defaultPrisma } from "../../server/lib/prisma-client.js";

const cloneValue = (value) => {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const DB_DATASET_KEYS = [
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

export const loadDbDatasets = async (client = defaultPrisma) => {
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
    client.postRecord.findMany({ orderBy: { position: "asc" } }),
    client.projectRecord.findMany({ orderBy: { position: "asc" } }),
    client.userRecord.findMany({ orderBy: { position: "asc" } }),
    client.commentRecord.findMany({ orderBy: { position: "asc" } }),
    client.updateRecord.findMany({ orderBy: { position: "asc" } }),
    client.uploadRecord.findMany({ orderBy: { position: "asc" } }),
    client.linkTypeRecord.findMany({ orderBy: { position: "asc" } }),
    client.ownerIdRecord.findMany({ orderBy: { position: "asc" } }),
    client.allowedUserRecord.findMany({ orderBy: { position: "asc" } }),
    client.auditLogRecord.findMany({ orderBy: { position: "asc" } }),
    client.analyticsEventRecord.findMany({ orderBy: { position: "asc" } }),
    client.pagesRecord.findUnique({ where: { id: 1 } }),
    client.siteSettingsRecord.findUnique({ where: { id: 1 } }),
    client.tagTranslationsRecord.findUnique({ where: { id: 1 } }),
    client.analyticsDailyRecord.findUnique({ where: { id: 1 } }),
    client.analyticsMetaRecord.findUnique({ where: { id: 1 } }),
  ]);

  return {
    posts: posts.map((row) => cloneValue(row.data)),
    projects: projects.map((row) => cloneValue(row.data)),
    users: users.map((row) => cloneValue(row.data)),
    comments: comments.map((row) => cloneValue(row.data)),
    updates: updates.map((row) => cloneValue(row.data)),
    uploads: uploads.map((row) => cloneValue(row.data)),
    linkTypes: linkTypes.map((row) => cloneValue(row.data)),
    ownerIds: ownerIds.map((row) => String(row.userId)),
    allowedUsers: allowedUsers.map((row) => String(row.userId)),
    auditLog: auditLog.map((row) => cloneValue(row.data)),
    analyticsEvents: analyticsEvents.map((row) => cloneValue(row.data)),
    pages: pages?.data && typeof pages.data === "object" ? cloneValue(pages.data) : {},
    siteSettings:
      siteSettings?.data && typeof siteSettings.data === "object" ? cloneValue(siteSettings.data) : {},
    tagTranslations:
      tagTranslations?.data && typeof tagTranslations.data === "object"
        ? cloneValue(tagTranslations.data)
        : { tags: {}, genres: {}, staffRoles: {} },
    analyticsDaily:
      analyticsDaily?.data && typeof analyticsDaily.data === "object"
        ? cloneValue(analyticsDaily.data)
        : { schemaVersion: 1, generatedAt: new Date().toISOString(), days: {} },
    analyticsMeta:
      analyticsMeta?.data && typeof analyticsMeta.data === "object"
        ? cloneValue(analyticsMeta.data)
        : {
            schemaVersion: 1,
            retentionDays: 90,
            aggregateRetentionDays: 365,
            updatedAt: new Date().toISOString(),
          },
  };
};

const syncRowsByPk = async ({ client, modelName, pk, rows }) => {
  const model = client[modelName];
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

const upsertSingleton = async ({ client, modelName, id, payload }) => {
  const model = client[modelName];
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

const persistPosts = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.posts).map((post, index) => ({
    id: String(post?.id || crypto.randomUUID()),
    position: index,
    slug: String(post?.slug || post?.id || crypto.randomUUID()),
    projectId: String(post?.projectId || ""),
    status: String(post?.status || "draft"),
    publishedAt: toDateOrNull(post?.publishedAt),
    deletedAt: toDateOrNull(post?.deletedAt),
    data: cloneValue(post || {}),
  }));
  await syncRowsByPk({ client, modelName: "postRecord", pk: "id", rows });
};

const persistProjects = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.projects).map((project, index) => ({
    id: String(project?.id || crypto.randomUUID()),
    position: index,
    deletedAt: toDateOrNull(project?.deletedAt),
    data: cloneValue(project || {}),
  }));
  await syncRowsByPk({ client, modelName: "projectRecord", pk: "id", rows });
};

const persistUsers = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.users).map((user, index) => ({
    id: String(user?.id || crypto.randomUUID()),
    position: index,
    accessRole: user?.accessRole ? String(user.accessRole) : null,
    status: user?.status ? String(user.status) : null,
    data: cloneValue(user || {}),
  }));
  await syncRowsByPk({ client, modelName: "userRecord", pk: "id", rows });
};

const persistComments = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.comments).map((comment, index) => ({
    id: String(comment?.id || crypto.randomUUID()),
    position: index,
    targetType: String(comment?.targetType || ""),
    targetId: String(comment?.targetId || ""),
    status: String(comment?.status || "pending"),
    createdAt: toDateOrNull(comment?.createdAt),
    data: cloneValue(comment || {}),
  }));
  await syncRowsByPk({ client, modelName: "commentRecord", pk: "id", rows });
};

const persistUpdates = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.updates).map((update, index) => ({
    id: String(update?.id || crypto.randomUUID()),
    position: index,
    projectId: String(update?.projectId || ""),
    updatedAt: toDateOrNull(update?.updatedAt),
    data: cloneValue(update || {}),
  }));
  await syncRowsByPk({ client, modelName: "updateRecord", pk: "id", rows });
};

const persistUploads = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.uploads).map((upload, index) => ({
    id: String(upload?.id || crypto.randomUUID()),
    position: index,
    url: String(upload?.url || ""),
    folder: String(upload?.folder || ""),
    createdAt: toDateOrNull(upload?.createdAt),
    data: cloneValue(upload || {}),
  }));
  await syncRowsByPk({ client, modelName: "uploadRecord", pk: "id", rows });
};

const persistLinkTypes = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.linkTypes).map((item, index) => ({
    id: String(item?.id || `link-${index}`),
    position: index,
    label: String(item?.label || ""),
    icon: String(item?.icon || ""),
    data: cloneValue(item || {}),
  }));
  await syncRowsByPk({ client, modelName: "linkTypeRecord", pk: "id", rows });
};

const persistOwnerIds = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.ownerIds).map((userId, index) => ({
    userId: String(userId),
    position: index,
  }));
  await syncRowsByPk({ client, modelName: "ownerIdRecord", pk: "userId", rows });
};

const persistAllowedUsers = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.allowedUsers).map((userId, index) => ({
    userId: String(userId),
    position: index,
  }));
  await syncRowsByPk({ client, modelName: "allowedUserRecord", pk: "userId", rows });
};

const persistAuditLog = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.auditLog).map((entry, index) => ({
    id: String(entry?.id || crypto.randomUUID()),
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
    data: cloneValue(entry || {}),
  }));
  await syncRowsByPk({ client, modelName: "auditLogRecord", pk: "id", rows });
};

const persistAnalyticsEvents = async ({ client, datasets }) => {
  const rows = ensureArray(datasets.analyticsEvents).map((event, index) => ({
    id: String(event?.id || crypto.randomUUID()),
    position: index,
    ts: toDateOrNull(event?.ts) || new Date(),
    day: String(event?.day || ""),
    eventType: String(event?.eventType || "view"),
    resourceType: String(event?.resourceType || "post"),
    resourceId: String(event?.resourceId || ""),
    visitorHash: String(event?.visitorHash || "anonymous"),
    referrerHost: String(event?.referrerHost || "(direct)"),
    isAuthenticated: Boolean(event?.isAuthenticated),
    data: cloneValue(event || {}),
  }));
  await syncRowsByPk({ client, modelName: "analyticsEventRecord", pk: "id", rows });
};

const persistPages = async ({ client, datasets }) => {
  await upsertSingleton({
    client,
    modelName: "pagesRecord",
    id: 1,
    payload: {
      data: datasets.pages && typeof datasets.pages === "object" ? cloneValue(datasets.pages) : {},
    },
  });
};

const persistSiteSettings = async ({ client, datasets }) => {
  await upsertSingleton({
    client,
    modelName: "siteSettingsRecord",
    id: 1,
    payload: {
      data:
        datasets.siteSettings && typeof datasets.siteSettings === "object"
          ? cloneValue(datasets.siteSettings)
          : {},
    },
  });
};

const persistTagTranslations = async ({ client, datasets }) => {
  await upsertSingleton({
    client,
    modelName: "tagTranslationsRecord",
    id: 1,
    payload: {
      data:
        datasets.tagTranslations && typeof datasets.tagTranslations === "object"
          ? cloneValue(datasets.tagTranslations)
          : { tags: {}, genres: {}, staffRoles: {} },
    },
  });
};

const persistAnalyticsDaily = async ({ client, datasets }) => {
  const daily = datasets.analyticsDaily && typeof datasets.analyticsDaily === "object" ? datasets.analyticsDaily : {};
  await upsertSingleton({
    client,
    modelName: "analyticsDailyRecord",
    id: 1,
    payload: {
      schemaVersion: Number(daily.schemaVersion || 1),
      generatedAt: toDateOrNull(daily.generatedAt) || new Date(),
      data: cloneValue(daily),
    },
  });
};

const persistAnalyticsMeta = async ({ client, datasets }) => {
  const meta = datasets.analyticsMeta && typeof datasets.analyticsMeta === "object" ? datasets.analyticsMeta : {};
  await upsertSingleton({
    client,
    modelName: "analyticsMetaRecord",
    id: 1,
    payload: {
      schemaVersion: Number(meta.schemaVersion || 1),
      retentionDays: Number(meta.retentionDays || 90),
      aggregateRetentionDays: Number(meta.aggregateRetentionDays || 365),
      updatedAt: toDateOrNull(meta.updatedAt) || new Date(),
      data: cloneValue(meta),
    },
  });
};

const PERSISTERS = {
  posts: persistPosts,
  projects: persistProjects,
  users: persistUsers,
  comments: persistComments,
  updates: persistUpdates,
  uploads: persistUploads,
  linkTypes: persistLinkTypes,
  ownerIds: persistOwnerIds,
  allowedUsers: persistAllowedUsers,
  auditLog: persistAuditLog,
  analyticsEvents: persistAnalyticsEvents,
  pages: persistPages,
  siteSettings: persistSiteSettings,
  tagTranslations: persistTagTranslations,
  analyticsDaily: persistAnalyticsDaily,
  analyticsMeta: persistAnalyticsMeta,
};

export const persistDbDatasets = async (client = defaultPrisma, datasets, changedKeys = []) => {
  const uniqueKeys = Array.from(new Set(ensureArray(changedKeys).map((key) => String(key).trim()).filter(Boolean)));
  for (const key of uniqueKeys) {
    const persister = PERSISTERS[key];
    if (!persister) {
      throw new Error(`Unsupported dataset key: ${key}`);
    }
    await persister({ client, datasets });
  }
};

export const prisma = defaultPrisma;
