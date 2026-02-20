import crypto from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma-client.js";

const DEFAULT_DATA_SOURCE = "json";

const normalizeDataSource = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "db" ? "db" : "json";
};

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

class JsonDataRepository {
  constructor(options) {
    this.source = "json";
    this.rootDir = options.rootDir;
    this.dataDir = path.join(this.rootDir, "server", "data");
    this.ownerIdsFallback = ensureArray(options.ownerIdsFallback).map((item) => String(item));
    this.analyticsConfig = {
      schemaVersion: options.analyticsSchemaVersion,
      retentionDays: options.analyticsRetentionDays,
      aggregateRetentionDays: options.analyticsAggRetentionDays,
    };
  }

  getDataSource() {
    return this.source;
  }

  ensureDataDir() {
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  readJson(fileName, fallback) {
    this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      return cloneValue(fallback);
    }
    try {
      const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
      return JSON.parse(raw);
    } catch {
      return cloneValue(fallback);
    }
  }

  writeJson(fileName, value) {
    this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  }

  readJsonLines(fileName) {
    this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  writeJsonLines(fileName, rows) {
    this.ensureDataDir();
    const filePath = path.join(this.dataDir, fileName);
    const lines = ensureArray(rows).map((row) => JSON.stringify(row));
    fs.writeFileSync(filePath, `${lines.join("\n")}${lines.length ? "\n" : ""}`);
  }

  loadOwnerIds() {
    const parsed = this.readJson("owner-ids.json", []);
    const fileIds = ensureArray(parsed).map((id) => String(id));
    return Array.from(new Set([...this.ownerIdsFallback, ...fileIds]));
  }

  writeOwnerIds(ids) {
    const unique = Array.from(
      new Set(ensureArray(ids).map((id) => String(id).trim()).filter(Boolean)),
    );
    this.writeJson("owner-ids.json", unique);
  }

  loadAuditLog() {
    return ensureArray(this.readJson("audit-log.json", []));
  }

  writeAuditLog(entries) {
    this.writeJson("audit-log.json", ensureArray(entries));
  }

  loadAnalyticsEvents() {
    return this.readJsonLines("analytics-events.jsonl");
  }

  writeAnalyticsEvents(events) {
    this.writeJsonLines("analytics-events.jsonl", ensureArray(events));
  }

  loadAnalyticsDaily() {
    const fallback = buildDefaultAnalyticsDaily(this.analyticsConfig);
    const parsed = this.readJson("analytics-daily.json", fallback);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return {
      schemaVersion: Number(parsed.schemaVersion) || fallback.schemaVersion,
      generatedAt: String(parsed.generatedAt || fallback.generatedAt),
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
    };
  }

  writeAnalyticsDaily(data) {
    const fallback = buildDefaultAnalyticsDaily(this.analyticsConfig);
    const payload = {
      schemaVersion: this.analyticsConfig.schemaVersion,
      generatedAt: String(data?.generatedAt || fallback.generatedAt),
      days: data?.days && typeof data.days === "object" ? data.days : {},
    };
    this.writeJson("analytics-daily.json", payload);
  }

  loadAnalyticsMeta() {
    const fallback = buildDefaultAnalyticsMeta(this.analyticsConfig);
    const parsed = this.readJson("analytics-meta.json", fallback);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
    };
  }

  writeAnalyticsMeta(value) {
    const payload = buildDefaultAnalyticsMeta(this.analyticsConfig, value);
    this.writeJson("analytics-meta.json", payload);
  }

  loadAllowedUsers() {
    return ensureArray(this.readJson("allowed-users.json", [])).map((id) => String(id));
  }

  writeAllowedUsers(ids) {
    this.writeJson(
      "allowed-users.json",
      ensureArray(ids).map((id) => String(id)),
    );
  }

  loadUsers() {
    return ensureArray(this.readJson("users.json", []));
  }

  writeUsers(users) {
    this.writeJson("users.json", ensureArray(users));
  }

  loadLinkTypes() {
    return ensureArray(this.readJson("link-types.json", []));
  }

  writeLinkTypes(items) {
    this.writeJson("link-types.json", ensureArray(items));
  }

  loadPosts() {
    return ensureArray(this.readJson("posts.json", []));
  }

  writePosts(posts) {
    this.writeJson("posts.json", ensureArray(posts));
  }

  loadProjects() {
    return ensureArray(this.readJson("projects.json", []));
  }

  writeProjects(projects) {
    this.writeJson("projects.json", ensureArray(projects));
  }

  loadUpdates() {
    return ensureArray(this.readJson("updates.json", []));
  }

  writeUpdates(updates) {
    this.writeJson("updates.json", ensureArray(updates));
  }

  loadTagTranslations() {
    return this.readJson("tag-translations.json", { tags: {}, genres: {}, staffRoles: {} });
  }

  writeTagTranslations(payload) {
    this.writeJson("tag-translations.json", payload && typeof payload === "object" ? payload : {});
  }

  loadComments() {
    return ensureArray(this.readJson("comments.json", []));
  }

  writeComments(comments) {
    this.writeJson("comments.json", ensureArray(comments));
  }

  loadUploads() {
    const filePath = path.join(this.dataDir, "uploads.json");
    if (!fs.existsSync(filePath)) {
      this.writeJson("uploads.json", []);
      return [];
    }
    return ensureArray(this.readJson("uploads.json", []));
  }

  writeUploads(uploads) {
    this.writeJson("uploads.json", ensureArray(uploads));
  }

  loadPages() {
    return this.readJson("pages.json", {});
  }

  writePages(pages) {
    this.writeJson("pages.json", pages && typeof pages === "object" ? pages : {});
  }

  loadSiteSettings() {
    return this.readJson("site-settings.json", {});
  }

  writeSiteSettings(settings) {
    this.writeJson("site-settings.json", settings && typeof settings === "object" ? settings : {});
  }
}

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
      projects: [],
      updates: [],
      tagTranslations: { tags: {}, genres: {}, staffRoles: {} },
      comments: [],
      uploads: [],
      pages: {},
      siteSettings: {},
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
    const message = `[data-repository:${label}] ${error?.message || error}`;
    console.error(message);
    if (typeof this.onBackgroundError === "function") {
      this.onBackgroundError({ label, error });
    }
  }

  enqueuePersist(label, fn) {
    this.persistQueue = this.persistQueue
      .then(async () => {
        try {
          await fn();
        } catch (error) {
          this.reportError(label, error);
        }
      })
      .catch((error) => {
        this.reportError(label, error);
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
      projects,
      updates,
      tagTranslations,
      comments,
      uploads,
      pages,
      siteSettings,
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
      prisma.projectRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.updateRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.tagTranslationsRecord.findUnique({ where: { id: 1 } }),
      prisma.commentRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.uploadRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.pagesRecord.findUnique({ where: { id: 1 } }),
      prisma.siteSettingsRecord.findUnique({ where: { id: 1 } }),
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
    this.snapshot.projects = projects.map((row) => cloneValue(row.data));
    this.snapshot.updates = updates.map((row) => cloneValue(row.data));
    this.snapshot.tagTranslations = tagTranslations?.data
      ? cloneValue(tagTranslations.data)
      : { tags: {}, genres: {}, staffRoles: {} };
    this.snapshot.comments = comments.map((row) => cloneValue(row.data));
    this.snapshot.uploads = uploads.map((row) => cloneValue(row.data));
    this.snapshot.pages = pages?.data ? cloneValue(pages.data) : {};
    this.snapshot.siteSettings = siteSettings?.data ? cloneValue(siteSettings.data) : {};
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
}

export const createDataRepository = async (options) => {
  const source = normalizeDataSource(options.dataSource || DEFAULT_DATA_SOURCE);
  if (source === "db") {
    if (!String(options.databaseUrl || "").trim()) {
      throw new Error("DATA_SOURCE=db requires DATABASE_URL");
    }
    return DbDataRepository.create(options);
  }
  return new JsonDataRepository(options);
};
