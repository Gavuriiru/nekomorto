export const registerAuditRoutes = ({
  AUDIT_CSV_MAX_ROWS,
  app,
  canViewAuditLog,
  isAuditActionEnabled,
  loadAuditLog,
  parseAuditTs,
  requireAuth,
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
};
