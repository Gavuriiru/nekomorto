import crypto from "crypto";
import fs from "fs";
import path from "path";

export const registerExportsRoutes = ({
  ADMIN_EXPORT_DATASETS,
  app,
  appendAuditLog,
  canManageSecurityAdmin,
  enqueueAdminExportJob,
  loadAdminExportJobs,
  metricsRegistry,
  normalizeExportDataset,
  normalizeExportFilters,
  normalizeExportFormat,
  normalizeExportStatus,
  requireAuth,
  toAdminExportJobApiResponse,
  upsertAdminExportJob,
} = {}) => {
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
    rows.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    const total = rows.length;
    const start = (page - 1) * limit;
    const paged = rows
      .slice(start, start + limit)
      .map((entry) => toAdminExportJobApiResponse(entry));
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
};
