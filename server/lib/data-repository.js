import crypto from "crypto";
import { prisma } from "./prisma-client.js";

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

const buildDefaultAnalyticsDaily = ({ schemaVersion }) => ({
  schemaVersion,
  generatedAt: new Date().toISOString(),
  days: {},
});

const buildDefaultAnalyticsMeta = ({ schemaVersion, retentionDays, aggregateRetentionDays }, override = {}) => ({
  schemaVersion,
  retentionDays,
  aggregateRetentionDays,
  updatedAt: new Date().toISOString(),
  ...override,
});

class DbDataRepository {
  constructor(options) {
    this.source = "db";
    this.ownerIdsFallback = ensureArray(options.ownerIdsFallback).map((item) => String(item));
    this.analyticsConfig = {
      schemaVersion: options.analyticsSchemaVersion,
      retentionDays: options.analyticsRetentionDays,
      aggregateRetentionDays: options.analyticsAggRetentionDays,
    };
    this.onBackgroundError = options.onBackgroundError;
    this.persistQueue = Promise.resolve();
    this.health = {
      queueDepth: 0,
      oldestPendingEnqueuedAt: null,
      lastPersistStartedAt: null,
      lastPersistCompletedAt: null,
      lastPersistErrorAt: null,
      lastPersistErrorLabel: null,
      lastPersistErrorMessage: null,
    };
    this.snapshot = {
      ownerIds: [],
      auditLog: [],
      analyticsEvents: [],
      analyticsDaily: buildDefaultAnalyticsDaily(this.analyticsConfig),
      analyticsMeta: buildDefaultAnalyticsMeta(this.analyticsConfig),
      allowedUsers: [],
      users: [],
      linkTypes: [],
      posts: [],
      postVersions: [],
      projects: [],
      updates: [],
      tagTranslations: { tags: {}, genres: {}, staffRoles: {} },
      comments: [],
      uploads: [],
      pages: {},
      siteSettings: {},
      userPreferences: {},
    };
  }

  static async create(options) {
    const repo = new DbDataRepository(options);
    await repo.hydrate();
    return repo;
  }

  getDataSource() {
    return this.source;
  }

  reportError(label, error) {
    this.health.lastPersistErrorAt = new Date().toISOString();
    this.health.lastPersistErrorLabel = String(label || "");
    this.health.lastPersistErrorMessage = String(error?.message || error || "").slice(0, 500);
    const message = `[data-repository:${label}] ${error?.message || error}`;
    console.error(message);
    if (typeof this.onBackgroundError === "function") {
      this.onBackgroundError({ label, error });
    }
  }

  enqueuePersist(label, fn) {
    const enqueuedAt = Date.now();
    this.health.queueDepth += 1;
    if (
      !Number.isFinite(Number(this.health.oldestPendingEnqueuedAt)) ||
      Number(this.health.oldestPendingEnqueuedAt) > enqueuedAt
    ) {
      this.health.oldestPendingEnqueuedAt = enqueuedAt;
    }
    let finished = false;
    const markDone = () => {
      if (finished) {
        return;
      }
      finished = true;
      this.health.queueDepth = Math.max(0, Number(this.health.queueDepth || 0) - 1);
      if (this.health.queueDepth === 0) {
        this.health.oldestPendingEnqueuedAt = null;
      }
    };
    this.persistQueue = this.persistQueue
      .then(async () => {
        this.health.lastPersistStartedAt = new Date().toISOString();
        try {
          await fn();
          this.health.lastPersistCompletedAt = new Date().toISOString();
        } catch (error) {
          this.reportError(label, error);
        } finally {
          markDone();
        }
      })
      .catch((error) => {
        this.reportError(label, error);
        markDone();
      });
  }

  async hydrate() {
    const [
      ownerIds,
      auditLogs,
      analyticsEvents,
      analyticsDaily,
      analyticsMeta,
      allowedUsers,
      users,
      linkTypes,
      posts,
      postVersions,
      projects,
      updates,
      tagTranslations,
      comments,
      uploads,
      pages,
      siteSettings,
      userPreferences,
    ] = await Promise.all([
      prisma.ownerIdRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.auditLogRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.analyticsEventRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.analyticsDailyRecord.findUnique({ where: { id: 1 } }),
      prisma.analyticsMetaRecord.findUnique({ where: { id: 1 } }),
      prisma.allowedUserRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.userRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.linkTypeRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.postRecord.findMany({ orderBy: { position: "asc" } }),
      typeof prisma.postVersionRecord?.findMany === "function"
        ? prisma.postVersionRecord
            .findMany({ orderBy: { position: "asc" } })
            .catch(() => [])
        : Promise.resolve([]),
      prisma.projectRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.updateRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.tagTranslationsRecord.findUnique({ where: { id: 1 } }),
      prisma.commentRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.uploadRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.pagesRecord.findUnique({ where: { id: 1 } }),
      prisma.siteSettingsRecord.findUnique({ where: { id: 1 } }),
      prisma.userPreferenceRecord.findMany({}),
    ]);

    this.snapshot.ownerIds = Array.from(
      new Set([
        ...this.ownerIdsFallback,
        ...ownerIds.map((item) => String(item.userId)),
      ]),
    );
    this.snapshot.auditLog = auditLogs.map((row) => cloneValue(row.data));
    this.snapshot.analyticsEvents = analyticsEvents.map((row) => cloneValue(row.data));
    this.snapshot.analyticsDaily = analyticsDaily?.data
      ? cloneValue(analyticsDaily.data)
      : buildDefaultAnalyticsDaily(this.analyticsConfig);
    this.snapshot.analyticsMeta = analyticsMeta?.data
      ? cloneValue(analyticsMeta.data)
      : buildDefaultAnalyticsMeta(this.analyticsConfig);
    this.snapshot.allowedUsers = allowedUsers.map((item) => String(item.userId));
    this.snapshot.users = users.map((row) => cloneValue(row.data));
    this.snapshot.linkTypes = linkTypes.map((row) => cloneValue(row.data));
    this.snapshot.posts = posts.map((row) => cloneValue(row.data));
    this.snapshot.postVersions = postVersions.map((row) => cloneValue(row.data));
    this.snapshot.projects = projects.map((row) => cloneValue(row.data));
    this.snapshot.updates = updates.map((row) => cloneValue(row.data));
    this.snapshot.tagTranslations = tagTranslations?.data
      ? cloneValue(tagTranslations.data)
      : { tags: {}, genres: {}, staffRoles: {} };
    this.snapshot.comments = comments.map((row) => cloneValue(row.data));
    this.snapshot.uploads = uploads.map((row) => cloneValue(row.data));
    this.snapshot.pages = pages?.data ? cloneValue(pages.data) : {};
    this.snapshot.siteSettings = siteSettings?.data ? cloneValue(siteSettings.data) : {};
    this.snapshot.userPreferences = userPreferences.reduce((acc, row) => {
      const userId = String(row?.userId || "").trim();
      if (!userId) {
        return acc;
      }
      acc[userId] = cloneValue(row.data);
      return acc;
    }, {});
  }

  loadOwnerIds() {
    return cloneValue(this.snapshot.ownerIds);
  }

  writeOwnerIds(ids) {
    const unique = Array.from(
      new Set(ensureArray(ids).map((id) => String(id).trim()).filter(Boolean)),
    );
    this.snapshot.ownerIds = unique;
    this.enqueuePersist("owner_ids", async () => {
      const rows = this.snapshot.ownerIds.map((userId, index) => ({ userId, position: index }));
      await prisma.$transaction([
        prisma.ownerIdRecord.deleteMany({}),
        ...(rows.length ? [prisma.ownerIdRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadAuditLog() {
    return cloneValue(this.snapshot.auditLog);
  }

  writeAuditLog(entries) {
    this.snapshot.auditLog = cloneValue(ensureArray(entries));
    this.enqueuePersist("audit_logs", async () => {
      const rows = this.snapshot.auditLog.map((entry, index) => ({
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
      await prisma.$transaction([
        prisma.auditLogRecord.deleteMany({}),
        ...(rows.length ? [prisma.auditLogRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadAnalyticsEvents() {
    return cloneValue(this.snapshot.analyticsEvents);
  }

  writeAnalyticsEvents(events) {
    this.snapshot.analyticsEvents = cloneValue(ensureArray(events));
    this.enqueuePersist("analytics_events", async () => {
      const rows = this.snapshot.analyticsEvents.map((event, index) => ({
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
      await prisma.$transaction([
        prisma.analyticsEventRecord.deleteMany({}),
        ...(rows.length ? [prisma.analyticsEventRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadAnalyticsDaily() {
    return cloneValue(this.snapshot.analyticsDaily);
  }

  writeAnalyticsDaily(data) {
    const payload = {
      schemaVersion: this.analyticsConfig.schemaVersion,
      generatedAt: String(data?.generatedAt || new Date().toISOString()),
      days: data?.days && typeof data.days === "object" ? data.days : {},
    };
    this.snapshot.analyticsDaily = payload;
    this.enqueuePersist("analytics_daily", async () => {
      await prisma.analyticsDailyRecord.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          schemaVersion: Number(payload.schemaVersion) || this.analyticsConfig.schemaVersion,
          generatedAt: toDateOrNull(payload.generatedAt) || new Date(),
          data: cloneValue(payload),
        },
        update: {
          schemaVersion: Number(payload.schemaVersion) || this.analyticsConfig.schemaVersion,
          generatedAt: toDateOrNull(payload.generatedAt) || new Date(),
          data: cloneValue(payload),
        },
      });
    });
  }

  loadAnalyticsMeta() {
    return cloneValue(this.snapshot.analyticsMeta);
  }

  writeAnalyticsMeta(value) {
    const payload = buildDefaultAnalyticsMeta(this.analyticsConfig, value);
    this.snapshot.analyticsMeta = payload;
    this.enqueuePersist("analytics_meta", async () => {
      await prisma.analyticsMetaRecord.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          schemaVersion: Number(payload.schemaVersion) || this.analyticsConfig.schemaVersion,
          retentionDays: Number(payload.retentionDays) || this.analyticsConfig.retentionDays,
          aggregateRetentionDays:
            Number(payload.aggregateRetentionDays) || this.analyticsConfig.aggregateRetentionDays,
          updatedAt: toDateOrNull(payload.updatedAt) || new Date(),
          data: cloneValue(payload),
        },
        update: {
          schemaVersion: Number(payload.schemaVersion) || this.analyticsConfig.schemaVersion,
          retentionDays: Number(payload.retentionDays) || this.analyticsConfig.retentionDays,
          aggregateRetentionDays:
            Number(payload.aggregateRetentionDays) || this.analyticsConfig.aggregateRetentionDays,
          updatedAt: toDateOrNull(payload.updatedAt) || new Date(),
          data: cloneValue(payload),
        },
      });
    });
  }

  loadAllowedUsers() {
    return cloneValue(this.snapshot.allowedUsers);
  }

  writeAllowedUsers(ids) {
    this.snapshot.allowedUsers = ensureArray(ids).map((id) => String(id));
    this.enqueuePersist("allowed_users", async () => {
      const rows = this.snapshot.allowedUsers.map((userId, index) => ({ userId, position: index }));
      await prisma.$transaction([
        prisma.allowedUserRecord.deleteMany({}),
        ...(rows.length ? [prisma.allowedUserRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadUsers() {
    return cloneValue(this.snapshot.users);
  }

  writeUsers(users) {
    this.snapshot.users = cloneValue(ensureArray(users));
    this.enqueuePersist("users", async () => {
      const rows = this.snapshot.users.map((user, index) => ({
        id: String(user?.id || crypto.randomUUID()),
        position: index,
        accessRole: user?.accessRole ? String(user.accessRole) : null,
        status: user?.status ? String(user.status) : null,
        data: cloneValue(user || {}),
      }));
      await prisma.$transaction([
        prisma.userRecord.deleteMany({}),
        ...(rows.length ? [prisma.userRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadLinkTypes() {
    return cloneValue(this.snapshot.linkTypes);
  }

  writeLinkTypes(items) {
    this.snapshot.linkTypes = cloneValue(ensureArray(items));
    this.enqueuePersist("link_types", async () => {
      const rows = this.snapshot.linkTypes.map((item, index) => ({
        id: String(item?.id || `link-${index}`),
        position: index,
        label: String(item?.label || ""),
        icon: String(item?.icon || ""),
        data: cloneValue(item || {}),
      }));
      await prisma.$transaction([
        prisma.linkTypeRecord.deleteMany({}),
        ...(rows.length ? [prisma.linkTypeRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadPosts() {
    return cloneValue(this.snapshot.posts);
  }

  writePosts(posts) {
    this.snapshot.posts = cloneValue(ensureArray(posts));
    this.enqueuePersist("posts", async () => {
      const rows = this.snapshot.posts.map((post, index) => ({
        id: String(post?.id || crypto.randomUUID()),
        position: index,
        slug: String(post?.slug || post?.id || crypto.randomUUID()),
        projectId: String(post?.projectId || ""),
        status: String(post?.status || "draft"),
        publishedAt: toDateOrNull(post?.publishedAt),
        deletedAt: toDateOrNull(post?.deletedAt),
        data: cloneValue(post || {}),
      }));
      await prisma.$transaction([
        prisma.postRecord.deleteMany({}),
        ...(rows.length ? [prisma.postRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadPostVersions() {
    return cloneValue(this.snapshot.postVersions);
  }

  writePostVersions(entries) {
    this.snapshot.postVersions = cloneValue(ensureArray(entries));
    this.enqueuePersist("post_versions", async () => {
      const rows = this.snapshot.postVersions.map((entry, index) => ({
        id: String(entry?.id || crypto.randomUUID()),
        postId: String(entry?.postId || ""),
        position: index,
        versionNumber: Number.isFinite(Number(entry?.versionNumber))
          ? Number(entry.versionNumber)
          : index + 1,
        reason: String(entry?.reason || "update"),
        label: typeof entry?.label === "string" && entry.label.trim() ? String(entry.label) : null,
        actorId: typeof entry?.actorId === "string" && entry.actorId.trim() ? String(entry.actorId) : null,
        actorName: typeof entry?.actorName === "string" && entry.actorName.trim() ? String(entry.actorName) : null,
        slug: String(entry?.slug || entry?.data?.slug || ""),
        createdAt: toDateOrNull(entry?.createdAt) || new Date(),
        data: cloneValue(entry || {}),
      }));
      await prisma.$transaction([
        prisma.postVersionRecord.deleteMany({}),
        ...(rows.length ? [prisma.postVersionRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadProjects() {
    return cloneValue(this.snapshot.projects);
  }

  writeProjects(projects) {
    this.snapshot.projects = cloneValue(ensureArray(projects));
    this.enqueuePersist("projects", async () => {
      const rows = this.snapshot.projects.map((project, index) => ({
        id: String(project?.id || crypto.randomUUID()),
        position: index,
        deletedAt: toDateOrNull(project?.deletedAt),
        data: cloneValue(project || {}),
      }));
      await prisma.$transaction([
        prisma.projectRecord.deleteMany({}),
        ...(rows.length ? [prisma.projectRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadUpdates() {
    return cloneValue(this.snapshot.updates);
  }

  writeUpdates(updates) {
    this.snapshot.updates = cloneValue(ensureArray(updates));
    this.enqueuePersist("updates", async () => {
      const rows = this.snapshot.updates.map((update, index) => ({
        id: String(update?.id || crypto.randomUUID()),
        position: index,
        projectId: String(update?.projectId || ""),
        updatedAt: toDateOrNull(update?.updatedAt),
        data: cloneValue(update || {}),
      }));
      await prisma.$transaction([
        prisma.updateRecord.deleteMany({}),
        ...(rows.length ? [prisma.updateRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadTagTranslations() {
    return cloneValue(this.snapshot.tagTranslations);
  }

  writeTagTranslations(payload) {
    this.snapshot.tagTranslations =
      payload && typeof payload === "object" ? cloneValue(payload) : { tags: {}, genres: {}, staffRoles: {} };
    this.enqueuePersist("tag_translations", async () => {
      await prisma.tagTranslationsRecord.upsert({
        where: { id: 1 },
        create: { id: 1, data: cloneValue(this.snapshot.tagTranslations) },
        update: { data: cloneValue(this.snapshot.tagTranslations) },
      });
    });
  }

  loadComments() {
    return cloneValue(this.snapshot.comments);
  }

  writeComments(comments) {
    this.snapshot.comments = cloneValue(ensureArray(comments));
    this.enqueuePersist("comments", async () => {
      const rows = this.snapshot.comments.map((comment, index) => ({
        id: String(comment?.id || crypto.randomUUID()),
        position: index,
        targetType: String(comment?.targetType || ""),
        targetId: String(comment?.targetId || ""),
        status: String(comment?.status || "pending"),
        createdAt: toDateOrNull(comment?.createdAt),
        data: cloneValue(comment || {}),
      }));
      await prisma.$transaction([
        prisma.commentRecord.deleteMany({}),
        ...(rows.length ? [prisma.commentRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadUploads() {
    return cloneValue(this.snapshot.uploads);
  }

  writeUploads(uploads) {
    this.snapshot.uploads = cloneValue(ensureArray(uploads));
    this.enqueuePersist("uploads", async () => {
      const rows = this.snapshot.uploads.map((upload, index) => ({
        id: String(upload?.id || crypto.randomUUID()),
        position: index,
        url: String(upload?.url || ""),
        folder: String(upload?.folder || ""),
        createdAt: toDateOrNull(upload?.createdAt),
        data: cloneValue(upload || {}),
      }));
      await prisma.$transaction([
        prisma.uploadRecord.deleteMany({}),
        ...(rows.length ? [prisma.uploadRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  loadPages() {
    return cloneValue(this.snapshot.pages);
  }

  writePages(pages) {
    this.snapshot.pages = pages && typeof pages === "object" ? cloneValue(pages) : {};
    this.enqueuePersist("pages", async () => {
      await prisma.pagesRecord.upsert({
        where: { id: 1 },
        create: { id: 1, data: cloneValue(this.snapshot.pages) },
        update: { data: cloneValue(this.snapshot.pages) },
      });
    });
  }

  loadSiteSettings() {
    return cloneValue(this.snapshot.siteSettings);
  }

  writeSiteSettings(settings) {
    this.snapshot.siteSettings = settings && typeof settings === "object" ? cloneValue(settings) : {};
    this.enqueuePersist("site_settings", async () => {
      await prisma.siteSettingsRecord.upsert({
        where: { id: 1 },
        create: { id: 1, data: cloneValue(this.snapshot.siteSettings) },
        update: { data: cloneValue(this.snapshot.siteSettings) },
      });
    });
  }

  loadUserPreferences(userId) {
    const key = String(userId || "").trim();
    if (!key) {
      return {};
    }
    const stored = this.snapshot.userPreferences?.[key];
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }
    return cloneValue(stored);
  }

  writeUserPreferences(userId, preferences) {
    const key = String(userId || "").trim();
    if (!key) {
      return;
    }
    const nextPreferences =
      preferences && typeof preferences === "object" && !Array.isArray(preferences)
        ? cloneValue(preferences)
        : {};
    this.snapshot.userPreferences = this.snapshot.userPreferences || {};
    this.snapshot.userPreferences[key] = nextPreferences;
    this.enqueuePersist("user_preferences", async () => {
      await prisma.userPreferenceRecord.upsert({
        where: { userId: key },
        create: { userId: key, data: cloneValue(nextPreferences) },
        update: { data: cloneValue(nextPreferences) },
      });
    });
  }

  getHealthSnapshot() {
    const nowMs = Date.now();
    const oldestPendingMs =
      Number.isFinite(Number(this.health.oldestPendingEnqueuedAt)) && Number(this.health.oldestPendingEnqueuedAt) > 0
        ? Math.max(0, nowMs - Number(this.health.oldestPendingEnqueuedAt))
        : 0;
    return cloneValue({
      queueDepth: Math.max(0, Number(this.health.queueDepth || 0)),
      oldestPendingMs,
      lastPersistStartedAt: this.health.lastPersistStartedAt || null,
      lastPersistCompletedAt: this.health.lastPersistCompletedAt || null,
      lastPersistErrorAt: this.health.lastPersistErrorAt || null,
      lastPersistErrorLabel: this.health.lastPersistErrorLabel || null,
      lastPersistErrorMessage: this.health.lastPersistErrorMessage || null,
    });
  }
}

export const createDataRepository = async (options) => {
  if (!String(options.databaseUrl || "").trim()) {
    throw new Error("DATABASE_URL is required for DB repository");
  }
  return DbDataRepository.create(options);
};
