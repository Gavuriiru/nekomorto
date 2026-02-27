const VALID_CHECK_STATUS = new Set(["ok", "warning", "critical"]);

export const normalizeHealthCheck = (check) => {
  const name = String(check?.name || "").trim();
  if (!name) {
    return null;
  }
  const statusRaw = String(check?.status || "ok").trim().toLowerCase();
  return {
    name,
    status: VALID_CHECK_STATUS.has(statusRaw) ? statusRaw : "ok",
    latencyMs: Number.isFinite(Number(check?.latencyMs)) ? Math.round(Number(check.latencyMs)) : undefined,
    message: typeof check?.message === "string" ? check.message : undefined,
    meta:
      check?.meta && typeof check.meta === "object" && !Array.isArray(check.meta)
        ? check.meta
        : undefined,
  };
};

export const summarizeHealthChecks = (checks) => {
  const safeChecks = (Array.isArray(checks) ? checks : []).map(normalizeHealthCheck).filter(Boolean);
  const critical = safeChecks.filter((item) => item.status === "critical").length;
  const warning = safeChecks.filter((item) => item.status === "warning").length;
  const ok = safeChecks.filter((item) => item.status === "ok").length;
  return {
    total: safeChecks.length,
    ok,
    warning,
    critical,
  };
};

export const deriveHealthStatus = (checks) => {
  const summary = summarizeHealthChecks(checks);
  if (summary.critical > 0) {
    return "fail";
  }
  if (summary.warning > 0) {
    return "degraded";
  }
  return "ok";
};

export const buildHealthStatusResponse = ({
  checks = [],
  dataSource = "db",
  maintenanceMode = false,
  ts = new Date().toISOString(),
} = {}) => {
  const normalizedChecks = (Array.isArray(checks) ? checks : []).map(normalizeHealthCheck).filter(Boolean);
  const status = deriveHealthStatus(normalizedChecks);
  return {
    ok: status !== "fail",
    status,
    ts: String(ts || new Date().toISOString()),
    dataSource: String(dataSource || "db"),
    maintenanceMode: Boolean(maintenanceMode),
    checks: normalizedChecks,
    summary: summarizeHealthChecks(normalizedChecks),
  };
};

