import crypto from "crypto";
import fs from "fs";
import path from "path";

const registerSecurityEventStatusRoute = ({
  app,
  appendAuditLog,
  canManageSecurityAdmin,
  requireAuth,
  routePath,
  status,
  auditAction,
  toSecurityEventApiResponse,
  updateSecurityEventStatus,
} = {}) => {
  app.post(routePath, requireAuth, (req, res) => {
    if (!canManageSecurityAdmin(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const event = updateSecurityEventStatus({
      eventId: req.params.id,
      status,
      actorUserId: req.session?.user?.id || "system",
    });
    if (!event) {
      return res.status(404).json({ error: "not_found" });
    }
    appendAuditLog(req, auditAction, "security", { id: event.id });
    return res.json({ ok: true, event: toSecurityEventApiResponse(event) });
  });
};

export const registerAdminRoutes = ({
  ADMIN_EXPORT_DATASETS,
  AUDIT_CSV_MAX_ROWS,
  SecurityEventSeverity,
  SecurityEventStatus,
  WEBHOOK_DELIVERY_STATUS,
  app,
  appendAuditLog,
  appendSecretRotation,
  buildAnalyticsRange,
  buildDashboardOverviewResponsePayload,
  canManageComments,
  canManageIntegrations,
  canManageSecurityAdmin,
  canManageSettings,
  canViewAnalytics,
  canViewAuditLog,
  dataEncryptionKeyring,
  deleteUserMfaTotpRecord,
  emitSecurityEvent,
  enqueueAdminExportJob,
  evaluateOperationalMonitoring,
  filterAnalyticsEvents,
  filterByDateRange,
  filterExportEntries,
  getDayKeyFromTs,
  incrementCounter,
  isAuditActionEnabled,
  isOwner,
  isPrimaryOwner,
  listActiveSessionsForUser,
  loadAdminExportJobs,
  loadAnalyticsEvents,
  loadAuditLog,
  loadComments,
  loadProjects,
  loadPosts,
  loadSecretRotations,
  loadSecurityEvents,
  loadUserSessionIndexRecords,
  loadUsers,
  loadWebhookDeliveries,
  metricsRegistry,
  normalizeAnalyticsTypeFilter,
  normalizeExportDataset,
  normalizeExportFilters,
  normalizeExportFormat,
  normalizeExportStatus,
  normalizePosts,
  normalizeProjects,
  normalizeUsers,
  parseAnalyticsRangeDays,
  parseAnalyticsTs,
  parseAuditTs,
  parseDashboardNotificationsLimit,
  requireAuth,
  revokeSessionBySid,
  sessionCookieConfig,
  toAdminExportJobApiResponse,
  toDashboardNotificationId,
  toSecurityEventApiResponse,
  updateSecurityEventStatus,
  upsertAdminExportJob,
} = {}) => {
  app.get("/api/audit-log", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = req.session?.user?.id;
    if (!canViewAuditLog(userId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(Math.floor(limitRaw), 10), 100)
        : 50;

    const action = String(req.query.action || "").trim();
    const resource = String(req.query.resource || "").trim();
    const actorId = String(req.query.actorId || "").trim();
    const status = String(req.query.status || "")
      .trim()
      .toLowerCase();
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase();
    const format = String(req.query.format || "")
      .trim()
      .toLowerCase();
    const dateFromRaw = String(req.query.dateFrom || "").trim();
    const dateToRaw = String(req.query.dateTo || "").trim();
    const dateFromTs = dateFromRaw ? parseAuditTs(dateFromRaw) : null;
    const dateToTs = dateToRaw ? parseAuditTs(dateToRaw) : null;

    let entries = loadAuditLog();
    entries = entries.filter((entry) => isAuditActionEnabled(entry.action));
    if (action) {
      entries = entries.filter((entry) => entry.action === action);
    }
    if (resource) {
      entries = entries.filter((entry) => entry.resource === resource);
    }
    if (actorId) {
      entries = entries.filter((entry) => entry.actorId === actorId);
    }
    if (status && ["success", "failed", "denied"].includes(status)) {
      entries = entries.filter((entry) => entry.status === status);
    }
    if (dateFromTs !== null) {
      entries = entries.filter((entry) => {
        const ts = parseAuditTs(entry.ts);
        return ts !== null && ts >= dateFromTs;
      });
    }
    if (dateToTs !== null) {
      entries = entries.filter((entry) => {
        const ts = parseAuditTs(entry.ts);
        return ts !== null && ts <= dateToTs;
      });
    }
    if (q) {
      entries = entries.filter((entry) => {
        const haystack = [
          entry.actorName,
          entry.resourceId || "",
          entry.ip,
          entry.action,
          entry.resource,
          JSON.stringify(entry.meta || {}),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    entries.sort((a, b) => (parseAuditTs(b.ts) || 0) - (parseAuditTs(a.ts) || 0));

    if (format === "csv") {
      const escapeCsv = (value) => {
        const text = String(value ?? "");
        if (text.includes('"') || text.includes(",") || text.includes("\n")) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };

      const exportEntries = entries.slice(0, AUDIT_CSV_MAX_ROWS);
      const isTruncated = entries.length > exportEntries.length;
      const rows = [];
      rows.push("id,ts,actorId,actorName,action,resource,resourceId,status,ip,requestId,meta");
      exportEntries.forEach((entry) => {
        rows.push(
          [
            escapeCsv(entry.id),
            escapeCsv(entry.ts),
            escapeCsv(entry.actorId),
            escapeCsv(entry.actorName),
            escapeCsv(entry.action),
            escapeCsv(entry.resource),
            escapeCsv(entry.resourceId || ""),
            escapeCsv(entry.status),
            escapeCsv(entry.ip || ""),
            escapeCsv(entry.requestId || ""),
            escapeCsv(JSON.stringify(entry.meta || {})),
          ].join(","),
        );
      });
      const csv = `\uFEFF${rows.join("\n")}`;
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"audit-log-${stamp}.csv\"`);
      res.setHeader("X-Audit-Export-Truncated", isTruncated ? "1" : "0");
      res.setHeader("X-Audit-Export-Count", String(exportEntries.length));
      res.setHeader("X-Audit-Export-Total", String(entries.length));
      return res.status(200).send(csv);
    }

    const total = entries.length;
    const start = (page - 1) * limit;
    const paged = entries.slice(start, start + limit);

    return res.json({
      entries: paged,
      page,
      limit,
      total,
      filtersApplied: {
        action,
        resource,
        actorId,
        status: ["success", "failed", "denied"].includes(status) ? status : "",
        q,
        dateFrom: dateFromRaw,
        dateTo: dateToRaw,
      },
    });
  });

  app.get("/api/admin/security/events", requireAuth, (req, res) => {
    if (!canManageSecurityAdmin(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(Math.floor(limitRaw), 10), 200)
        : 50;
    const filters = normalizeExportFilters(req.query);
    let rows = loadSecurityEvents();
    rows = filterByDateRange(rows, {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      tsAccessor: (entry) => entry.ts,
    });
    rows = filterExportEntries(rows, filters, {
      fieldAccessors: {
        actorUserId: (entry) => entry.actorUserId,
        targetUserId: (entry) => entry.targetUserId,
        severity: (entry) => entry.severity,
        status: (entry) => entry.status,
        action: (entry) => entry.type,
      },
    });
    rows.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
    const total = rows.length;
    const start = (page - 1) * limit;
    const paged = rows.slice(start, start + limit).map((entry) => toSecurityEventApiResponse(entry));
    return res.json({ events: paged, page, limit, total });
  });

  registerSecurityEventStatusRoute({
    app,
    appendAuditLog,
    canManageSecurityAdmin,
    requireAuth,
    routePath: "/api/admin/security/events/:id/ack",
    status: SecurityEventStatus.ACK,
    auditAction: "security.event.ack",
    toSecurityEventApiResponse,
    updateSecurityEventStatus,
  });

  registerSecurityEventStatusRoute({
    app,
    appendAuditLog,
    canManageSecurityAdmin,
    requireAuth,
    routePath: "/api/admin/security/events/:id/resolve",
    status: SecurityEventStatus.RESOLVED,
    auditAction: "security.event.resolve",
    toSecurityEventApiResponse,
    updateSecurityEventStatus,
  });

  registerSecurityEventStatusRoute({
    app,
    appendAuditLog,
    canManageSecurityAdmin,
    requireAuth,
    routePath: "/api/admin/security/events/:id/ignore",
    status: SecurityEventStatus.IGNORED,
    auditAction: "security.event.ignore",
    toSecurityEventApiResponse,
    updateSecurityEventStatus,
  });

  app.get("/api/admin/security/rotation", requireAuth, (req, res) => {
    if (!isPrimaryOwner(req.session?.user?.id) && !canManageSecurityAdmin(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const recent = loadSecretRotations().slice(0, 50);
    return res.json({
      session: {
        acceptedSecretsCount: Number(sessionCookieConfig.acceptedSecretsCount || 0),
        activeSecretConfigured: Boolean(sessionCookieConfig.activeSecret),
      },
      encryption: {
        activeKeyId: dataEncryptionKeyring.activeKeyId || null,
        availableKeyIds: Object.keys(dataEncryptionKeyring.keys || {}),
      },
      recentRotations: recent,
    });
  });

  app.post("/api/admin/security/rotation", requireAuth, (req, res) => {
    if (!isPrimaryOwner(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const secretFamily = String(req.body?.secretFamily || "").trim();
    const keyId = String(req.body?.keyId || "").trim();
    if (!secretFamily || !keyId) {
      return res.status(400).json({ error: "secret_family_and_key_id_required" });
    }
    const entry = appendSecretRotation({
      id: crypto.randomUUID(),
      secretFamily,
      keyId,
      rotatedAt: new Date().toISOString(),
      rotatedBy: req.session?.user?.id || "system",
      notes: String(req.body?.notes || "").trim(),
      status: String(req.body?.status || "completed").trim() || "completed",
    });
    appendAuditLog(req, "security.rotation.record", "security", {
      secretFamily,
      keyId,
      id: entry?.id || null,
    });
    return res.status(201).json({ ok: true, rotation: entry });
  });

  app.post("/api/admin/users/:id/security/totp/reset", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!isOwner(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const targetId = String(req.params.id || "").trim();
    if (!targetId) {
      return res.status(400).json({ error: "invalid_target_id" });
    }
    deleteUserMfaTotpRecord(targetId);
    appendAuditLog(req, "auth.mfa.reset_admin", "users", { targetId });
    emitSecurityEvent({
      req,
      type: "mfa_reset_admin",
      severity: SecurityEventSeverity.WARNING,
      riskScore: 60,
      actorUserId: actorId || null,
      targetUserId: targetId,
      data: { targetId },
    });
    return res.json({ ok: true });
  });

  app.get("/api/admin/users/:id/sessions", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!isOwner(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const targetId = String(req.params.id || "").trim();
    if (!targetId) {
      return res.status(400).json({ error: "invalid_target_id" });
    }
    const sessions = listActiveSessionsForUser(targetId).map((entry) => ({
      sid: entry.sid,
      userId: entry.userId,
      createdAt: entry.createdAt || null,
      lastSeenAt: entry.lastSeenAt || null,
      lastIp: entry.lastIp || "",
      userAgent: entry.userAgent || "",
      current: false,
      isCurrent: false,
      revokedAt: entry.revokedAt || null,
      isPendingMfa: Boolean(entry.isPendingMfa),
    }));
    return res.json({ sessions });
  });

  app.get("/api/admin/sessions/active", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const actorId = String(req.session?.user?.id || "").trim();
    if (!isOwner(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(Math.floor(limitRaw), 1), 500)
        : 100;

    const usersById = new Map(
      normalizeUsers(loadUsers()).map((entry) => [String(entry.id || ""), entry]),
    );
    const currentSid = String(req.sessionID || "");
    const rows = loadUserSessionIndexRecords({ includeRevoked: false })
      .filter((entry) => !entry.revokedAt)
      .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
    const total = rows.length;
    const start = (page - 1) * limit;
    const sessions = rows.slice(start, start + limit).map((entry) => {
      const normalizedUserId = String(entry.userId || "").trim();
      const user = usersById.get(normalizedUserId) || null;
      return {
        sid: String(entry.sid || ""),
        userId: normalizedUserId,
        userName: String(user?.name || normalizedUserId || "usuario"),
        userAvatarUrl: user?.avatarUrl || null,
        createdAt: entry.createdAt || null,
        lastSeenAt: entry.lastSeenAt || null,
        lastIp: entry.lastIp || "",
        userAgent: entry.userAgent || "",
        isPendingMfa: Boolean(entry.isPendingMfa),
        currentForViewer: String(entry.sid || "") === currentSid,
      };
    });

    return res.json({
      sessions,
      page,
      limit,
      total,
    });
  });

  app.delete("/api/admin/users/:id/sessions/:sid", requireAuth, async (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!isOwner(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const targetId = String(req.params.id || "").trim();
    const sid = String(req.params.sid || "").trim();
    if (!targetId || !sid) {
      return res.status(400).json({ error: "invalid_params" });
    }
    const target = listActiveSessionsForUser(targetId).find(
      (entry) => String(entry.sid || "") === sid,
    );
    if (!target) {
      return res.status(404).json({ error: "session_not_found" });
    }
    await revokeSessionBySid({
      sid,
      revokedBy: actorId || null,
      revokeReason: "admin_revoke",
    });
    appendAuditLog(req, "auth.sessions.admin_revoke", "users", {
      targetId,
      sid,
    });
    return res.json({ ok: true });
  });

  app.post("/api/admin/exports", requireAuth, async (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!canManageSecurityAdmin(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const dataset = normalizeExportDataset(req.body?.dataset);
    const format = normalizeExportFormat(req.body?.format);
    if (!ADMIN_EXPORT_DATASETS.includes(dataset)) {
      return res.status(400).json({ error: "invalid_dataset" });
    }
    const filters = normalizeExportFilters(req.body?.filters || {});
    const job = upsertAdminExportJob({
      id: crypto.randomUUID(),
      dataset,
      format,
      status: "queued",
      requestedBy: actorId,
      filters,
      filePath: null,
      rowCount: null,
      error: null,
      createdAt: new Date().toISOString(),
    });
    if (!job) {
      return res.status(500).json({ error: "job_create_failed" });
    }
    metricsRegistry.inc("export_jobs_total", {
      status: "queued",
      dataset: String(dataset || "unknown"),
    });
    appendAuditLog(req, "admin.exports.create", "exports", {
      id: job.id,
      dataset,
      format,
    });
    void enqueueAdminExportJob(job.id).catch((error) => {
      console.error(
        `[admin-export] failed to enqueue job ${job.id}: ${String(error?.message || error)}`,
      );
    });
    return res.status(202).json({ job: toAdminExportJobApiResponse(job) });
  });

  app.get("/api/admin/exports", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!canManageSecurityAdmin(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(Math.floor(limitRaw), 10), 200)
        : 50;
    const statusFilter = normalizeExportStatus(req.query.status);
    const datasetFilter = normalizeExportDataset(req.query.dataset);
    let rows = loadAdminExportJobs();
    if (String(req.query.status || "").trim()) {
      rows = rows.filter((entry) => normalizeExportStatus(entry.status) === statusFilter);
    }
    if (String(req.query.dataset || "").trim()) {
      rows = rows.filter((entry) => normalizeExportDataset(entry.dataset) === datasetFilter);
    }
    if (String(req.query.requestedBy || "").trim()) {
      rows = rows.filter(
        (entry) => String(entry.requestedBy || "") === String(req.query.requestedBy || ""),
      );
    }
    rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const total = rows.length;
    const start = (page - 1) * limit;
    const paged = rows.slice(start, start + limit).map((entry) => toAdminExportJobApiResponse(entry));
    return res.json({ jobs: paged, page, limit, total });
  });

  app.get("/api/admin/exports/:id", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!canManageSecurityAdmin(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const job = loadAdminExportJobs().find(
      (entry) => String(entry?.id || "") === String(req.params.id || ""),
    );
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ job: toAdminExportJobApiResponse(job) });
  });

  app.get("/api/admin/exports/:id/download", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!canManageSecurityAdmin(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const job = loadAdminExportJobs().find(
      (entry) => String(entry?.id || "") === String(req.params.id || ""),
    );
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    if (normalizeExportStatus(job.status) !== "completed" || !job.filePath) {
      return res.status(409).json({ error: "job_not_completed" });
    }
    const expiresAtTs = new Date(job.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
      upsertAdminExportJob({
        ...job,
        status: "expired",
        error: "file_expired",
        filePath: null,
      });
      return res.status(410).json({ error: "export_expired" });
    }
    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: "file_not_found" });
    }
    appendAuditLog(req, "admin.exports.download", "exports", {
      id: job.id,
      dataset: job.dataset,
    });
    const extension = normalizeExportFormat(job.format) === "jsonl" ? "jsonl" : "csv";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${job.dataset}-${job.id}.${extension}\"`,
    );
    res.setHeader(
      "Content-Type",
      extension === "jsonl" ? "application/x-ndjson; charset=utf-8" : "text/csv; charset=utf-8",
    );
    return res.sendFile(path.resolve(job.filePath));
  });

  app.delete("/api/admin/exports/:id", requireAuth, (req, res) => {
    const actorId = String(req.session?.user?.id || "").trim();
    if (!canManageSecurityAdmin(actorId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const job = loadAdminExportJobs().find(
      (entry) => String(entry?.id || "") === String(req.params.id || ""),
    );
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    if (job.filePath && fs.existsSync(job.filePath)) {
      try {
        fs.unlinkSync(job.filePath);
      } catch {
        // ignore cleanup failure
      }
    }
    const expired = upsertAdminExportJob({
      ...job,
      status: "expired",
      filePath: null,
      finishedAt: job.finishedAt || new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      error: job.error || null,
    });
    appendAuditLog(req, "admin.exports.expire", "exports", { id: job.id });
    return res.json({ ok: true, job: expired ? toAdminExportJobApiResponse(expired) : null });
  });

  app.get("/api/analytics/overview", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const viewEvents = events.filter((event) => event.eventType === "view");
    const chapterViewEvents = events.filter((event) => event.eventType === "chapter_view");
    const downloadClickEvents = events.filter((event) => event.eventType === "download_click");
    const commentCreatedEvents = events.filter((event) => event.eventType === "comment_created");
    const commentApprovedEvents = events.filter((event) => event.eventType === "comment_approved");
    const uniqueVisitors = new Set(viewEvents.map((event) => event.visitorHash));

    return res.json({
      range: `${rangeDays}d`,
      type,
      from: new Date(range.fromTs).toISOString(),
      to: new Date(range.toTs).toISOString(),
      metrics: {
        views: viewEvents.length,
        uniqueViews: uniqueVisitors.size,
        chapterViews: chapterViewEvents.length,
        downloadClicks: downloadClickEvents.length,
        commentsCreated: commentCreatedEvents.length,
        commentsApproved: commentApprovedEvents.length,
      },
    });
  });

  app.get("/api/analytics/timeseries", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const metricRaw = String(req.query.metric || "")
      .trim()
      .toLowerCase();
    const metric = ["views", "unique_views", "comments", "chapter_views", "download_clicks"].includes(
      metricRaw,
    )
      ? metricRaw
      : "views";
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const perDay = Object.fromEntries(
      range.dayKeys.map((day) => [
        day,
        {
          views: 0,
          chapterViews: 0,
          downloadClicks: 0,
          comments: 0,
          uniqueVisitors: new Set(),
        },
      ]),
    );
    events.forEach((event) => {
      const ts = parseAnalyticsTs(event.ts);
      if (ts === null) {
        return;
      }
      const dayKey = getDayKeyFromTs(ts);
      if (!perDay[dayKey]) {
        return;
      }
      if (event.eventType === "view") {
        perDay[dayKey].views += 1;
        perDay[dayKey].uniqueVisitors.add(event.visitorHash);
        return;
      }
      if (event.eventType === "comment_created") {
        perDay[dayKey].comments += 1;
        return;
      }
      if (event.eventType === "chapter_view") {
        perDay[dayKey].chapterViews += 1;
        return;
      }
      if (event.eventType === "download_click") {
        perDay[dayKey].downloadClicks += 1;
      }
    });

    const pickMetricValue = (day) => {
      if (metric === "views") return perDay[day].views;
      if (metric === "comments") return perDay[day].comments;
      if (metric === "chapter_views") return perDay[day].chapterViews;
      if (metric === "download_clicks") return perDay[day].downloadClicks;
      return perDay[day].uniqueVisitors.size;
    };

    return res.json({
      range: `${rangeDays}d`,
      type,
      metric,
      series: range.dayKeys.map((day) => ({
        date: day,
        value: pickMetricValue(day),
      })),
    });
  });

  app.get("/api/analytics/top-content", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 50) : 10;
    const range = buildAnalyticsRange(rangeDays);
    const allEvents = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const viewEvents = allEvents.filter((event) => event.eventType === "view");
    const grouped = new Map();
    viewEvents.forEach((event) => {
      const resourceType = event.resourceType === "project" ? "project" : "post";
      const key = `${resourceType}:${event.resourceId}`;
      const previous = grouped.get(key) || {
        resourceType,
        resourceId: event.resourceId,
        views: 0,
        uniqueVisitors: new Set(),
      };
      previous.views += 1;
      previous.uniqueVisitors.add(event.visitorHash);
      grouped.set(key, previous);
    });

    const postsBySlug = new Map(normalizePosts(loadPosts()).map((post) => [post.slug, post]));
    const projectsById = new Map(
      normalizeProjects(loadProjects()).map((project) => [project.id, project]),
    );

    const entries = Array.from(grouped.values())
      .map((item) => {
        const title =
          item.resourceType === "project"
            ? projectsById.get(item.resourceId)?.title || `Projeto ${item.resourceId}`
            : postsBySlug.get(item.resourceId)?.title || `Post ${item.resourceId}`;
        return {
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          title,
          views: item.views,
          uniqueViews: item.uniqueVisitors.size,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    return res.json({
      range: `${rangeDays}d`,
      type,
      limit,
      entries,
    });
  });

  app.get("/api/analytics/acquisition", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(
      loadAnalyticsEvents(),
      range.fromTs,
      range.toTs,
      type,
    ).filter((event) => event.eventType === "view");

    const counters = {
      referrerHost: {},
      utmSource: {},
      utmMedium: {},
      utmCampaign: {},
    };

    events.forEach((event) => {
      incrementCounter(counters.referrerHost, event.referrerHost || "(direct)");
      if (event.utm?.source) incrementCounter(counters.utmSource, event.utm.source);
      if (event.utm?.medium) incrementCounter(counters.utmMedium, event.utm.medium);
      if (event.utm?.campaign) incrementCounter(counters.utmCampaign, event.utm.campaign);
    });

    const toSortedEntries = (target) =>
      Object.entries(target)
        .map(([key, value]) => ({ key, count: Number(value) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    return res.json({
      range: `${rangeDays}d`,
      type,
      referrerHost: toSortedEntries(counters.referrerHost),
      utmSource: toSortedEntries(counters.utmSource),
      utmMedium: toSortedEntries(counters.utmMedium),
      utmCampaign: toSortedEntries(counters.utmCampaign),
    });
  });

  app.get("/api/admin/operational-alerts", requireAuth, async (req, res) => {
    if (!canManageSettings(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    res.setHeader("Cache-Control", "no-store");
    const snapshot = await evaluateOperationalMonitoring();
    return res.json(snapshot.alerts);
  });

  app.get("/api/dashboard/overview", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.json(buildDashboardOverviewResponsePayload(userId));
  });

  app.get("/api/dashboard/notifications", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const items = [];
    const nowTs = Date.now();
    const limit = parseDashboardNotificationsLimit(req.query.limit);

    if (canManageComments(userId)) {
      const comments = loadComments();
      const pendingCount = comments.filter((comment) => comment.status === "pending").length;
      if (pendingCount > 0) {
        const ts = new Date().toISOString();
        items.push({
          id: toDashboardNotificationId(`comments:pending:${pendingCount}`),
          kind: "pending",
          source: "comments",
          severity: pendingCount > 20 ? "critical" : "warning",
          title: "Comentários pendentes",
          description:
            pendingCount === 1
              ? "Há 1 comentário aguardando moderação."
              : `Há ${pendingCount} comentários aguardando moderação.`,
          href: "/dashboard/comentarios",
          ts,
        });
      }
      const approvedSince = nowTs - 24 * 60 * 60 * 1000;
      const approvedRecent = comments.filter((comment) => {
        if (comment.status !== "approved") {
          return false;
        }
        const createdTs = new Date(comment.createdAt || 0).getTime();
        return Number.isFinite(createdTs) && createdTs >= approvedSince;
      }).length;
      if (approvedRecent > 0) {
        const ts = new Date().toISOString();
        items.push({
          id: toDashboardNotificationId(`comments:approved:${approvedRecent}`),
          kind: "approval",
          source: "comments",
          severity: "info",
          title: "Aprovações recentes",
          description:
            approvedRecent === 1
              ? "1 comentário foi aprovado nas últimas 24h."
              : `${approvedRecent} comentários foram aprovados nas últimas 24h.`,
          href: "/dashboard/comentarios",
          ts,
        });
      }
    }

    if (canManageSettings(userId)) {
      try {
        const snapshot = await evaluateOperationalMonitoring();
        const operationalAlerts = Array.isArray(snapshot?.alerts?.alerts)
          ? snapshot.alerts.alerts
          : [];
        operationalAlerts.forEach((alert) => {
          if (!alert || (alert.severity !== "critical" && alert.severity !== "warning")) {
            return;
          }
          items.push({
            id: toDashboardNotificationId(`ops:${alert.code}:${alert.since || snapshot.ts}`),
            kind: "error",
            source: "operations",
            severity: alert.severity,
            title: alert.title || "Alerta operacional",
            description: alert.description || "Falha operacional detectada.",
            href: "/dashboard",
            ts: alert.since || snapshot.ts || new Date().toISOString(),
          });
        });
      } catch {
        // ignore transient monitoring errors in notifications endpoint
      }
    }

    if (canManageIntegrations(userId)) {
      const webhookFailures = loadWebhookDeliveries()
        .filter(
          (entry) =>
            String(entry?.status || "").trim().toLowerCase() === WEBHOOK_DELIVERY_STATUS.FAILED,
        )
        .sort((a, b) => new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime())
        .slice(0, 10);
      webhookFailures.forEach((entry) => {
        items.push({
          id: toDashboardNotificationId(`webhook:${entry.id}:${entry.updatedAt}`),
          kind: "error",
          source: "webhooks",
          severity: "warning",
          title: "Falha em webhook",
          description:
            String(entry?.lastErrorCode || "").trim() ||
            String(entry?.lastError || "").trim() ||
            "Entrega falhou.",
          href: "/dashboard/webhooks",
          ts: entry.updatedAt || new Date().toISOString(),
        });
      });
    }

    const sorted = items
      .slice()
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
      .slice(0, limit);
    const summary = sorted.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.kind === "pending") acc.pending += 1;
        if (item.kind === "error") acc.error += 1;
        if (item.kind === "approval") acc.approval += 1;
        return acc;
      },
      { total: 0, pending: 0, error: 0, approval: 0 },
    );

    return res.json({
      generatedAt: new Date().toISOString(),
      items: sorted,
      summary,
    });
  });
};
