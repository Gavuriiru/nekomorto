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

const DEFAULT_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_AUDIT_MAX_ENTRIES = 20_000;

const toAuditTimestamp = (value) => {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.getTime() : null;
};

const compactAuditLogEntries = (
  entries,
  {
    nowTs = Date.now(),
    retentionMs = DEFAULT_AUDIT_RETENTION_MS,
    maxEntries = DEFAULT_AUDIT_MAX_ENTRIES,
  } = {},
) => {
  const safeRetentionMs = Math.max(0, Number(retentionMs) || 0);
  const safeMaxEntries = Math.max(0, Math.floor(Number(maxEntries) || 0));
  const cutoff = nowTs - safeRetentionMs;
  const filtered = ensureArray(entries)
    .filter((entry) => toAuditTimestamp(entry?.ts) !== null)
    .filter((entry) => Number(toAuditTimestamp(entry?.ts)) >= cutoff)
    .sort((left, right) => Number(toAuditTimestamp(left?.ts)) - Number(toAuditTimestamp(right?.ts)));
  if (safeMaxEntries === 0) {
    return [];
  }
  if (filtered.length <= safeMaxEntries) {
    return filtered;
  }
  return filtered.slice(filtered.length - safeMaxEntries);
};

const toAuditLogRow = (entry, position) => ({
  id: String(entry?.id || crypto.randomUUID()),
  position,
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
});

const buildDefaultAnalyticsDaily = ({ schemaVersion }) => ({
  schemaVersion,
  generatedAt: new Date().toISOString(),
  days: {},
});

const buildDefaultAnalyticsMeta = (
  { schemaVersion, retentionDays, aggregateRetentionDays },
  override = {},
) => ({
  schemaVersion,
  retentionDays,
  aggregateRetentionDays,
  updatedAt: new Date().toISOString(),
  ...override,
});

export class DbDataRepository {
  constructor(options) {
    this.source = "db";
    this.ownerIdsFallback = ensureArray(options.ownerIdsFallback).map((item) => String(item));
    this.analyticsConfig = {
      schemaVersion: options.analyticsSchemaVersion,
      retentionDays: options.analyticsRetentionDays,
      aggregateRetentionDays: options.analyticsAggRetentionDays,
    };
    this.auditRetentionMs = Math.max(
      0,
      Number(options.auditRetentionMs ?? DEFAULT_AUDIT_RETENTION_MS) || 0,
    );
    this.auditMaxEntries = Math.max(
      0,
      Math.floor(Number(options.auditMaxEntries ?? DEFAULT_AUDIT_MAX_ENTRIES) || 0),
    );
    this.auditLogNextPosition = 0;
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
      integrationSettings: {},
      userPreferences: {},
      userMfaTotpRecords: {},
      userSessionIndexRecords: [],
      securityEvents: [],
      adminExportJobs: [],
      secretRotations: [],
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

  async persistCollectionById({ model, rows, idKey = "id", updateFields = null }) {
    if (!model || typeof model.deleteMany !== "function" || typeof model.upsert !== "function") {
      throw new Error("persist_collection_model_invalid");
    }
    const safeRows = ensureArray(rows);
    const ids = safeRows.map((row) => String(row?.[idKey] || "").trim()).filter(Boolean);
    const tx = [];
    if (ids.length > 0) {
      tx.push(model.deleteMany({ where: { [idKey]: { notIn: ids } } }));
    } else {
      tx.push(model.deleteMany({}));
    }
    safeRows.forEach((row) => {
      const where = { [idKey]: row[idKey] };
      const update =
        Array.isArray(updateFields) && updateFields.length > 0
          ? updateFields.reduce((acc, field) => {
              acc[field] = row[field];
              return acc;
            }, {})
          : { ...row };
      tx.push(
        model.upsert({
          where,
          create: row,
          update,
        }),
      );
    });
    await prisma.$transaction(tx);
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
      integrationSettings,
      userPreferences,
      userMfaTotpRecords,
      userSessionIndexRecords,
      securityEvents,
      adminExportJobs,
      secretRotations,
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
        ? prisma.postVersionRecord.findMany({ orderBy: { position: "asc" } }).catch(() => [])
        : Promise.resolve([]),
      prisma.projectRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.updateRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.tagTranslationsRecord.findUnique({ where: { id: 1 } }),
      prisma.commentRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.uploadRecord.findMany({ orderBy: { position: "asc" } }),
      prisma.pagesRecord.findUnique({ where: { id: 1 } }),
      prisma.siteSettingsRecord.findUnique({ where: { id: 1 } }),
      typeof prisma.integrationSettingsRecord?.findUnique === "function"
        ? prisma.integrationSettingsRecord.findUnique({ where: { id: 1 } }).catch(() => null)
        : Promise.resolve(null),
      prisma.userPreferenceRecord.findMany({}),
      typeof prisma.userMfaTotpRecord?.findMany === "function"
        ? prisma.userMfaTotpRecord.findMany({})
        : Promise.resolve([]),
      typeof prisma.userSessionIndexRecord?.findMany === "function"
        ? prisma.userSessionIndexRecord.findMany({ orderBy: { lastSeenAt: "desc" } })
        : Promise.resolve([]),
      typeof prisma.securityEventRecord?.findMany === "function"
        ? prisma.securityEventRecord.findMany({ orderBy: { ts: "desc" } })
        : Promise.resolve([]),
      typeof prisma.adminExportJobRecord?.findMany === "function"
        ? prisma.adminExportJobRecord.findMany({ orderBy: { createdAt: "desc" } })
        : Promise.resolve([]),
      typeof prisma.secretRotationRecord?.findMany === "function"
        ? prisma.secretRotationRecord.findMany({ orderBy: { rotatedAt: "desc" } })
        : Promise.resolve([]),
    ]);

    this.snapshot.ownerIds = Array.from(
      new Set([...this.ownerIdsFallback, ...ownerIds.map((item) => String(item.userId))]),
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
    this.snapshot.integrationSettings = integrationSettings?.data
      ? cloneValue(integrationSettings.data)
      : {};
    this.snapshot.userPreferences = userPreferences.reduce((acc, row) => {
      const userId = String(row?.userId || "").trim();
      if (!userId) {
        return acc;
      }
      acc[userId] = cloneValue(row.data);
      return acc;
    }, {});
    this.snapshot.userMfaTotpRecords = userMfaTotpRecords.reduce((acc, row) => {
      const userId = String(row?.userId || "").trim();
      if (!userId) {
        return acc;
      }
      acc[userId] = {
        userId,
        secretEncrypted: String(row?.secretEncrypted || ""),
        secretKeyId: String(row?.secretKeyId || ""),
        enabledAt: row?.enabledAt ? new Date(row.enabledAt).toISOString() : null,
        disabledAt: row?.disabledAt ? new Date(row.disabledAt).toISOString() : null,
        recoveryCodesHashed: cloneValue(row?.recoveryCodesHashed || []),
        createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
      return acc;
    }, {});
    this.snapshot.userSessionIndexRecords = userSessionIndexRecords.map((row) => ({
      sid: String(row?.sid || ""),
      userId: String(row?.userId || ""),
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      lastSeenAt: row?.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
      lastIp: row?.lastIp ? String(row.lastIp) : "",
      userAgent: row?.userAgent ? String(row.userAgent) : "",
      revokedAt: row?.revokedAt ? new Date(row.revokedAt).toISOString() : null,
      revokedBy: row?.revokedBy ? String(row.revokedBy) : null,
      revokeReason: row?.revokeReason ? String(row.revokeReason) : null,
      isPendingMfa: Boolean(row?.isPendingMfa),
    }));
    this.snapshot.securityEvents = securityEvents.map((row) => ({
      id: String(row?.id || ""),
      ts: row?.ts ? new Date(row.ts).toISOString() : new Date().toISOString(),
      type: String(row?.type || ""),
      severity: String(row?.severity || "info"),
      riskScore: Number(row?.riskScore || 0),
      status: String(row?.status || "open"),
      actorUserId: row?.actorUserId ? String(row.actorUserId) : null,
      targetUserId: row?.targetUserId ? String(row.targetUserId) : null,
      ip: row?.ip ? String(row.ip) : "",
      userAgent: row?.userAgent ? String(row.userAgent) : "",
      sessionId: row?.sessionId ? String(row.sessionId) : null,
      requestId: row?.requestId ? String(row.requestId) : null,
      data: cloneValue(row?.data || {}),
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));
    this.snapshot.adminExportJobs = adminExportJobs.map((row) => ({
      id: String(row?.id || ""),
      dataset: String(row?.dataset || ""),
      format: String(row?.format || "csv"),
      status: String(row?.status || "queued"),
      requestedBy: String(row?.requestedBy || ""),
      filters: cloneValue(row?.filters || {}),
      filePath: row?.filePath ? String(row.filePath) : null,
      rowCount: Number.isFinite(Number(row?.rowCount)) ? Number(row.rowCount) : null,
      error: row?.error ? String(row.error) : null,
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      startedAt: row?.startedAt ? new Date(row.startedAt).toISOString() : null,
      finishedAt: row?.finishedAt ? new Date(row.finishedAt).toISOString() : null,
      expiresAt: row?.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));
    this.snapshot.secretRotations = secretRotations.map((row) => ({
      id: String(row?.id || ""),
      secretFamily: String(row?.secretFamily || ""),
      keyId: String(row?.keyId || ""),
      rotatedAt: row?.rotatedAt ? new Date(row.rotatedAt).toISOString() : new Date().toISOString(),
      rotatedBy: String(row?.rotatedBy || "system"),
      notes: row?.notes ? String(row.notes) : "",
      status: String(row?.status || "completed"),
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));
    this.auditLogNextPosition = auditLogs.reduce((max, row) => {
      const nextPosition = Number(row?.position);
      if (!Number.isFinite(nextPosition)) {
        return max;
      }
      return Math.max(max, Math.floor(nextPosition) + 1);
    }, 0);
  }

  loadOwnerIds() {
    return cloneValue(this.snapshot.ownerIds);
  }

  writeOwnerIds(ids) {
    const unique = Array.from(
      new Set(
        ensureArray(ids)
          .map((id) => String(id).trim())
          .filter(Boolean),
      ),
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
    this.auditLogNextPosition = this.snapshot.auditLog.length;
    this.enqueuePersist("audit_logs", async () => {
      const rows = this.snapshot.auditLog.map((entry, index) => toAuditLogRow(entry, index));
      await prisma.$transaction([
        prisma.auditLogRecord.deleteMany({}),
        ...(rows.length ? [prisma.auditLogRecord.createMany({ data: rows })] : []),
      ]);
    });
  }

  appendAuditLogEntry(entry) {
    const baseEntry =
      entry && typeof entry === "object" && !Array.isArray(entry) ? cloneValue(entry) : {};
    const normalizedEntry = {
      ...baseEntry,
      id: String(baseEntry?.id || crypto.randomUUID()),
      ts: (toDateOrNull(baseEntry?.ts) || new Date()).toISOString(),
      actorId: String(baseEntry?.actorId || "anonymous"),
      actorName: String(baseEntry?.actorName || "anonymous"),
      ip: String(baseEntry?.ip || ""),
      action: String(baseEntry?.action || ""),
      resource: String(baseEntry?.resource || ""),
      resourceId: baseEntry?.resourceId ? String(baseEntry.resourceId) : null,
      status: String(baseEntry?.status || "success"),
      requestId: baseEntry?.requestId ? String(baseEntry.requestId) : null,
    };
    const previousEntries = ensureArray(this.snapshot.auditLog);
    const nextEntries = compactAuditLogEntries([...previousEntries, normalizedEntry], {
      retentionMs: this.auditRetentionMs,
      maxEntries: this.auditMaxEntries,
    });
    const nextIds = new Set(
      nextEntries.map((item) => String(item?.id || "").trim()).filter(Boolean),
    );
    const removedIds = previousEntries
      .map((item) => String(item?.id || "").trim())
      .filter((id) => id && !nextIds.has(id));
    const shouldPersistEntry = nextIds.has(normalizedEntry.id);
    const position = this.auditLogNextPosition;
    this.snapshot.auditLog = nextEntries;
    if (shouldPersistEntry) {
      this.auditLogNextPosition += 1;
    }
    if (!shouldPersistEntry && removedIds.length === 0) {
      return;
    }
    this.enqueuePersist("audit_log_append", async () => {
      const operations = [];
      if (shouldPersistEntry) {
        operations.push(
          prisma.auditLogRecord.create({
            data: toAuditLogRow(normalizedEntry, position),
          }),
        );
      }
      if (removedIds.length > 0) {
        operations.push(
          prisma.auditLogRecord.deleteMany({
            where: {
              id: {
                in: removedIds,
              },
            },
          }),
        );
      }
      if (operations.length === 0) {
        return;
      }
      await prisma.$transaction(operations);
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
      await this.persistCollectionById({
        model: prisma.userRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "accessRole", "status", "data"],
      });
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
      await this.persistCollectionById({
        model: prisma.linkTypeRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "label", "icon", "data"],
      });
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
      await this.persistCollectionById({
        model: prisma.postRecord,
        rows,
        idKey: "id",
        updateFields: [
          "position",
          "slug",
          "projectId",
          "status",
          "publishedAt",
          "deletedAt",
          "data",
        ],
      });
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
        actorId:
          typeof entry?.actorId === "string" && entry.actorId.trim() ? String(entry.actorId) : null,
        actorName:
          typeof entry?.actorName === "string" && entry.actorName.trim()
            ? String(entry.actorName)
            : null,
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
      await this.persistCollectionById({
        model: prisma.projectRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "deletedAt", "data"],
      });
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
      await this.persistCollectionById({
        model: prisma.updateRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "projectId", "updatedAt", "data"],
      });
    });
  }

  loadTagTranslations() {
    return cloneValue(this.snapshot.tagTranslations);
  }

  writeTagTranslations(payload) {
    this.snapshot.tagTranslations =
      payload && typeof payload === "object"
        ? cloneValue(payload)
        : { tags: {}, genres: {}, staffRoles: {} };
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
      await this.persistCollectionById({
        model: prisma.commentRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "targetType", "targetId", "status", "createdAt", "data"],
      });
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
      await this.persistCollectionById({
        model: prisma.uploadRecord,
        rows,
        idKey: "id",
        updateFields: ["position", "url", "folder", "createdAt", "data"],
      });
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
    this.snapshot.siteSettings =
      settings && typeof settings === "object" ? cloneValue(settings) : {};
    this.enqueuePersist("site_settings", async () => {
      await prisma.siteSettingsRecord.upsert({
        where: { id: 1 },
        create: { id: 1, data: cloneValue(this.snapshot.siteSettings) },
        update: { data: cloneValue(this.snapshot.siteSettings) },
      });
    });
  }

  loadIntegrationSettings() {
    return cloneValue(this.snapshot.integrationSettings);
  }

  writeIntegrationSettings(settings) {
    this.snapshot.integrationSettings =
      settings && typeof settings === "object" ? cloneValue(settings) : {};
    this.enqueuePersist("integration_settings", async () => {
      if (typeof prisma.integrationSettingsRecord?.upsert !== "function") {
        return;
      }
      await prisma.integrationSettingsRecord.upsert({
        where: { id: 1 },
        create: { id: 1, data: cloneValue(this.snapshot.integrationSettings) },
        update: { data: cloneValue(this.snapshot.integrationSettings) },
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

  loadUserMfaTotpRecord(userId) {
    const key = String(userId || "").trim();
    if (!key) {
      return null;
    }
    const row = this.snapshot.userMfaTotpRecords?.[key];
    return row ? cloneValue(row) : null;
  }

  writeUserMfaTotpRecord(userId, record) {
    const key = String(userId || "").trim();
    if (!key) {
      return;
    }
    const row = {
      userId: key,
      secretEncrypted: String(record?.secretEncrypted || ""),
      secretKeyId: String(record?.secretKeyId || ""),
      enabledAt: record?.enabledAt ? String(record.enabledAt) : new Date().toISOString(),
      disabledAt: record?.disabledAt ? String(record.disabledAt) : null,
      recoveryCodesHashed: cloneValue(
        Array.isArray(record?.recoveryCodesHashed) ? record.recoveryCodesHashed : [],
      ),
    };
    this.snapshot.userMfaTotpRecords = this.snapshot.userMfaTotpRecords || {};
    this.snapshot.userMfaTotpRecords[key] = row;
    this.enqueuePersist("user_mfa_totp", async () => {
      await prisma.userMfaTotpRecord.upsert({
        where: { userId: key },
        create: {
          userId: key,
          secretEncrypted: row.secretEncrypted,
          secretKeyId: row.secretKeyId,
          enabledAt: toDateOrNull(row.enabledAt) || new Date(),
          disabledAt: toDateOrNull(row.disabledAt),
          recoveryCodesHashed: cloneValue(row.recoveryCodesHashed),
        },
        update: {
          secretEncrypted: row.secretEncrypted,
          secretKeyId: row.secretKeyId,
          enabledAt: toDateOrNull(row.enabledAt),
          disabledAt: toDateOrNull(row.disabledAt),
          recoveryCodesHashed: cloneValue(row.recoveryCodesHashed),
        },
      });
    });
  }

  deleteUserMfaTotpRecord(userId) {
    const key = String(userId || "").trim();
    if (!key) {
      return;
    }
    if (this.snapshot.userMfaTotpRecords) {
      delete this.snapshot.userMfaTotpRecords[key];
    }
    this.enqueuePersist("user_mfa_totp_delete", async () => {
      await prisma.userMfaTotpRecord.deleteMany({ where: { userId: key } });
    });
  }

  loadUserSessionIndexRecords({ userId = null, includeRevoked = true } = {}) {
    const normalizedUserId = String(userId || "").trim();
    return cloneValue(this.snapshot.userSessionIndexRecords || []).filter((record) => {
      if (normalizedUserId && String(record.userId) !== normalizedUserId) {
        return false;
      }
      if (!includeRevoked && record.revokedAt) {
        return false;
      }
      return true;
    });
  }

  upsertUserSessionIndexRecord(record) {
    const sid = String(record?.sid || "").trim();
    const userId = String(record?.userId || "").trim();
    if (!sid || !userId) {
      return;
    }
    const normalized = {
      sid,
      userId,
      createdAt: String(record?.createdAt || new Date().toISOString()),
      lastSeenAt: String(record?.lastSeenAt || new Date().toISOString()),
      lastIp: String(record?.lastIp || ""),
      userAgent: String(record?.userAgent || ""),
      revokedAt: record?.revokedAt ? String(record.revokedAt) : null,
      revokedBy: record?.revokedBy ? String(record.revokedBy) : null,
      revokeReason: record?.revokeReason ? String(record.revokeReason) : null,
      isPendingMfa: Boolean(record?.isPendingMfa),
    };
    const list = ensureArray(this.snapshot.userSessionIndexRecords);
    const index = list.findIndex((item) => String(item?.sid || "") === sid);
    if (index >= 0) {
      list[index] = normalized;
    } else {
      list.push(normalized);
    }
    this.snapshot.userSessionIndexRecords = list;
    this.enqueuePersist("user_session_index", async () => {
      await prisma.userSessionIndexRecord.upsert({
        where: { sid },
        create: {
          sid,
          userId: normalized.userId,
          createdAt: toDateOrNull(normalized.createdAt) || new Date(),
          lastSeenAt: toDateOrNull(normalized.lastSeenAt) || new Date(),
          lastIp: normalized.lastIp || null,
          userAgent: normalized.userAgent || null,
          revokedAt: toDateOrNull(normalized.revokedAt),
          revokedBy: normalized.revokedBy,
          revokeReason: normalized.revokeReason,
          isPendingMfa: normalized.isPendingMfa,
        },
        update: {
          userId: normalized.userId,
          lastSeenAt: toDateOrNull(normalized.lastSeenAt) || new Date(),
          lastIp: normalized.lastIp || null,
          userAgent: normalized.userAgent || null,
          revokedAt: toDateOrNull(normalized.revokedAt),
          revokedBy: normalized.revokedBy,
          revokeReason: normalized.revokeReason,
          isPendingMfa: normalized.isPendingMfa,
        },
      });
    });
  }

  revokeUserSessionIndexRecord(sid, { revokedBy = null, revokeReason = null } = {}) {
    const key = String(sid || "").trim();
    if (!key) {
      return;
    }
    const list = ensureArray(this.snapshot.userSessionIndexRecords);
    const index = list.findIndex((item) => String(item?.sid || "") === key);
    if (index < 0) {
      return;
    }
    const current = list[index];
    list[index] = {
      ...current,
      revokedAt: new Date().toISOString(),
      revokedBy: revokedBy ? String(revokedBy) : null,
      revokeReason: revokeReason ? String(revokeReason) : null,
    };
    this.snapshot.userSessionIndexRecords = list;
    const persisted = list[index];
    this.enqueuePersist("user_session_index_revoke", async () => {
      await prisma.userSessionIndexRecord.updateMany({
        where: { sid: key },
        data: {
          revokedAt: toDateOrNull(persisted.revokedAt) || new Date(),
          revokedBy: persisted.revokedBy,
          revokeReason: persisted.revokeReason,
        },
      });
    });
  }

  removeUserSessionIndexRecord(sid) {
    const key = String(sid || "").trim();
    if (!key) {
      return;
    }
    this.snapshot.userSessionIndexRecords = ensureArray(this.snapshot.userSessionIndexRecords).filter(
      (item) => String(item?.sid || "") !== key,
    );
    this.enqueuePersist("user_session_index_delete", async () => {
      await prisma.userSessionIndexRecord.deleteMany({ where: { sid: key } });
    });
  }

  loadSecurityEvents() {
    return cloneValue(this.snapshot.securityEvents || []);
  }

  writeSecurityEvents(events) {
    this.snapshot.securityEvents = cloneValue(ensureArray(events));
    this.enqueuePersist("security_events", async () => {
      const rows = this.snapshot.securityEvents.map((event) => ({
        id: String(event?.id || crypto.randomUUID()),
        ts: toDateOrNull(event?.ts) || new Date(),
        type: String(event?.type || ""),
        severity: String(event?.severity || "info"),
        riskScore: Number.isFinite(Number(event?.riskScore)) ? Math.floor(Number(event.riskScore)) : 0,
        status: String(event?.status || "open"),
        actorUserId: event?.actorUserId ? String(event.actorUserId) : null,
        targetUserId: event?.targetUserId ? String(event.targetUserId) : null,
        ip: event?.ip ? String(event.ip) : null,
        userAgent: event?.userAgent ? String(event.userAgent) : null,
        sessionId: event?.sessionId ? String(event.sessionId) : null,
        requestId: event?.requestId ? String(event.requestId) : null,
        data: cloneValue(event?.data || {}),
      }));
      await this.persistCollectionById({
        model: prisma.securityEventRecord,
        rows,
        idKey: "id",
        updateFields: [
          "ts",
          "type",
          "severity",
          "riskScore",
          "status",
          "actorUserId",
          "targetUserId",
          "ip",
          "userAgent",
          "sessionId",
          "requestId",
          "data",
        ],
      });
    });
  }

  upsertSecurityEvent(event) {
    const id = String(event?.id || "").trim() || crypto.randomUUID();
    const list = ensureArray(this.snapshot.securityEvents);
    const index = list.findIndex((item) => String(item?.id || "") === id);
    const normalized = {
      id,
      ts: String(event?.ts || new Date().toISOString()),
      type: String(event?.type || ""),
      severity: String(event?.severity || "info"),
      riskScore: Number.isFinite(Number(event?.riskScore)) ? Math.floor(Number(event.riskScore)) : 0,
      status: String(event?.status || "open"),
      actorUserId: event?.actorUserId ? String(event.actorUserId) : null,
      targetUserId: event?.targetUserId ? String(event.targetUserId) : null,
      ip: event?.ip ? String(event.ip) : "",
      userAgent: event?.userAgent ? String(event.userAgent) : "",
      sessionId: event?.sessionId ? String(event.sessionId) : null,
      requestId: event?.requestId ? String(event.requestId) : null,
      data: cloneValue(event?.data || {}),
    };
    if (index >= 0) {
      list[index] = normalized;
    } else {
      list.push(normalized);
    }
    this.snapshot.securityEvents = list.sort((a, b) => {
      const aTs = new Date(a.ts || 0).getTime();
      const bTs = new Date(b.ts || 0).getTime();
      return bTs - aTs;
    });
    this.enqueuePersist("security_event_upsert", async () => {
      await prisma.securityEventRecord.upsert({
        where: { id },
        create: {
          id,
          ts: toDateOrNull(normalized.ts) || new Date(),
          type: normalized.type,
          severity: normalized.severity,
          riskScore: normalized.riskScore,
          status: normalized.status,
          actorUserId: normalized.actorUserId,
          targetUserId: normalized.targetUserId,
          ip: normalized.ip || null,
          userAgent: normalized.userAgent || null,
          sessionId: normalized.sessionId,
          requestId: normalized.requestId,
          data: cloneValue(normalized.data),
        },
        update: {
          ts: toDateOrNull(normalized.ts) || new Date(),
          type: normalized.type,
          severity: normalized.severity,
          riskScore: normalized.riskScore,
          status: normalized.status,
          actorUserId: normalized.actorUserId,
          targetUserId: normalized.targetUserId,
          ip: normalized.ip || null,
          userAgent: normalized.userAgent || null,
          sessionId: normalized.sessionId,
          requestId: normalized.requestId,
          data: cloneValue(normalized.data),
        },
      });
    });
    return cloneValue(normalized);
  }

  loadAdminExportJobs() {
    return cloneValue(this.snapshot.adminExportJobs || []);
  }

  upsertAdminExportJob(job) {
    const id = String(job?.id || "").trim();
    if (!id) {
      return null;
    }
    const normalized = {
      id,
      dataset: String(job?.dataset || "audit_log"),
      format: String(job?.format || "csv"),
      status: String(job?.status || "queued"),
      requestedBy: String(job?.requestedBy || ""),
      filters: cloneValue(job?.filters || {}),
      filePath: job?.filePath ? String(job.filePath) : null,
      rowCount: Number.isFinite(Number(job?.rowCount)) ? Number(job.rowCount) : null,
      error: job?.error ? String(job.error) : null,
      createdAt: String(job?.createdAt || new Date().toISOString()),
      startedAt: job?.startedAt ? String(job.startedAt) : null,
      finishedAt: job?.finishedAt ? String(job.finishedAt) : null,
      expiresAt: job?.expiresAt ? String(job.expiresAt) : null,
      updatedAt: String(job?.updatedAt || new Date().toISOString()),
    };
    const list = ensureArray(this.snapshot.adminExportJobs);
    const index = list.findIndex((item) => String(item?.id || "") === id);
    if (index >= 0) {
      list[index] = normalized;
    } else {
      list.push(normalized);
    }
    this.snapshot.adminExportJobs = list.sort((a, b) => {
      const aTs = new Date(a.createdAt || 0).getTime();
      const bTs = new Date(b.createdAt || 0).getTime();
      return bTs - aTs;
    });
    this.enqueuePersist("admin_export_job", async () => {
      await prisma.adminExportJobRecord.upsert({
        where: { id },
        create: {
          id,
          dataset: normalized.dataset,
          format: normalized.format,
          status: normalized.status,
          requestedBy: normalized.requestedBy,
          filters: cloneValue(normalized.filters),
          filePath: normalized.filePath,
          rowCount: normalized.rowCount,
          error: normalized.error,
          createdAt: toDateOrNull(normalized.createdAt) || new Date(),
          startedAt: toDateOrNull(normalized.startedAt),
          finishedAt: toDateOrNull(normalized.finishedAt),
          expiresAt: toDateOrNull(normalized.expiresAt),
        },
        update: {
          dataset: normalized.dataset,
          format: normalized.format,
          status: normalized.status,
          requestedBy: normalized.requestedBy,
          filters: cloneValue(normalized.filters),
          filePath: normalized.filePath,
          rowCount: normalized.rowCount,
          error: normalized.error,
          startedAt: toDateOrNull(normalized.startedAt),
          finishedAt: toDateOrNull(normalized.finishedAt),
          expiresAt: toDateOrNull(normalized.expiresAt),
        },
      });
    });
    return cloneValue(normalized);
  }

  loadSecretRotations() {
    return cloneValue(this.snapshot.secretRotations || []);
  }

  appendSecretRotation(entry) {
    const normalized = {
      id: String(entry?.id || crypto.randomUUID()),
      secretFamily: String(entry?.secretFamily || ""),
      keyId: String(entry?.keyId || ""),
      rotatedAt: String(entry?.rotatedAt || new Date().toISOString()),
      rotatedBy: String(entry?.rotatedBy || "system"),
      notes: entry?.notes ? String(entry.notes) : "",
      status: String(entry?.status || "completed"),
      createdAt: String(entry?.createdAt || new Date().toISOString()),
    };
    this.snapshot.secretRotations = [normalized, ...ensureArray(this.snapshot.secretRotations)]
      .sort((a, b) => new Date(b.rotatedAt || 0).getTime() - new Date(a.rotatedAt || 0).getTime())
      .slice(0, 1000);
    this.enqueuePersist("secret_rotation", async () => {
      await prisma.secretRotationRecord.upsert({
        where: { id: normalized.id },
        create: {
          id: normalized.id,
          secretFamily: normalized.secretFamily,
          keyId: normalized.keyId,
          rotatedAt: toDateOrNull(normalized.rotatedAt) || new Date(),
          rotatedBy: normalized.rotatedBy,
          notes: normalized.notes || null,
          status: normalized.status,
          createdAt: toDateOrNull(normalized.createdAt) || new Date(),
        },
        update: {
          secretFamily: normalized.secretFamily,
          keyId: normalized.keyId,
          rotatedAt: toDateOrNull(normalized.rotatedAt) || new Date(),
          rotatedBy: normalized.rotatedBy,
          notes: normalized.notes || null,
          status: normalized.status,
        },
      });
    });
    return cloneValue(normalized);
  }

  getHealthSnapshot() {
    const nowMs = Date.now();
    const oldestPendingMs =
      Number.isFinite(Number(this.health.oldestPendingEnqueuedAt)) &&
      Number(this.health.oldestPendingEnqueuedAt) > 0
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
