const VALID_SEVERITIES = new Set(["info", "warning", "critical"]);

const severityRank = (severity) => {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
};

export const normalizeOperationalAlert = (alert) => {
  const code = String(alert?.code || "").trim();
  if (!code) {
    return null;
  }
  const severity = String(alert?.severity || "info").trim().toLowerCase();
  return {
    code,
    severity: VALID_SEVERITIES.has(severity) ? severity : "info",
    title: String(alert?.title || code).trim() || code,
    description: String(alert?.description || "").trim(),
    since: alert?.since ? String(alert.since) : null,
    meta:
      alert?.meta && typeof alert.meta === "object" && !Array.isArray(alert.meta)
        ? alert.meta
        : undefined,
  };
};

export const sortOperationalAlerts = (alerts) =>
  (Array.isArray(alerts) ? alerts : [])
    .map(normalizeOperationalAlert)
    .filter(Boolean)
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      const aSince = new Date(a.since || 0).getTime();
      const bSince = new Date(b.since || 0).getTime();
      if (Number.isFinite(aSince) && Number.isFinite(bSince) && aSince !== bSince) {
        return aSince - bSince;
      }
      return a.code.localeCompare(b.code, "pt-BR");
    });

export const summarizeOperationalAlerts = (alerts) => {
  const normalized = sortOperationalAlerts(alerts);
  const summary = {
    total: normalized.length,
    critical: 0,
    warning: 0,
    info: 0,
  };
  normalized.forEach((alert) => {
    if (alert.severity === "critical") summary.critical += 1;
    else if (alert.severity === "warning") summary.warning += 1;
    else summary.info += 1;
  });
  return summary;
};

export const deriveOverallStatusFromChecks = (checks) => {
  const safeChecks = Array.isArray(checks) ? checks : [];
  const hasCritical = safeChecks.some((check) => String(check?.status || "").toLowerCase() === "critical");
  if (hasCritical) {
    return "fail";
  }
  const hasWarning = safeChecks.some((check) => String(check?.status || "").toLowerCase() === "warning");
  if (hasWarning) {
    return "degraded";
  }
  return "ok";
};

export const buildOperationalAlertsV1 = ({
  maintenanceMode = false,
  dbCheck = null,
  repositoryHealth = null,
  session = null,
  now = new Date(),
  thresholds = {},
} = {}) => {
  const nowIso = new Date(now || Date.now()).toISOString();
  const dbLatencyWarningMs = Number.isFinite(Number(thresholds.dbLatencyWarningMs))
    ? Number(thresholds.dbLatencyWarningMs)
    : 1000;
  const repoQueueDepthWarning = Number.isFinite(Number(thresholds.repoQueueDepthWarning))
    ? Number(thresholds.repoQueueDepthWarning)
    : 10;
  const repoOldestPendingWarningMs = Number.isFinite(Number(thresholds.repoOldestPendingWarningMs))
    ? Number(thresholds.repoOldestPendingWarningMs)
    : 30_000;
  const recentPersistErrorWindowMs = Number.isFinite(Number(thresholds.recentPersistErrorWindowMs))
    ? Number(thresholds.recentPersistErrorWindowMs)
    : 15 * 60 * 1000;

  const alerts = [];

  if (maintenanceMode) {
    alerts.push({
      code: "maintenance_mode_enabled",
      severity: "warning",
      title: "Modo de manutenção ativo",
      description: "Requisições mutáveis da API estão bloqueadas pelo modo de manutenção.",
      since: nowIso,
    });
  }

  const dbStatus = String(dbCheck?.status || "").toLowerCase();
  if (dbStatus === "critical") {
    alerts.push({
      code: "db_unhealthy",
      severity: "critical",
      title: "Banco de dados indisponível",
      description: String(dbCheck?.message || "Falha no ping do banco de dados."),
      since: nowIso,
      meta: {
        latencyMs: Number.isFinite(Number(dbCheck?.latencyMs)) ? Number(dbCheck.latencyMs) : undefined,
      },
    });
  } else if (
    (dbStatus === "ok" || dbStatus === "warning") &&
    Number.isFinite(Number(dbCheck?.latencyMs)) &&
    Number(dbCheck.latencyMs) > dbLatencyWarningMs
  ) {
    alerts.push({
      code: "db_latency_high",
      severity: "warning",
      title: "Latência alta no banco",
      description: `Ping do banco acima do limite (${Math.round(Number(dbCheck.latencyMs))}ms).`,
      since: nowIso,
      meta: {
        latencyMs: Math.round(Number(dbCheck.latencyMs)),
        thresholdMs: dbLatencyWarningMs,
      },
    });
  }

  const queueDepth = Number(repositoryHealth?.queueDepth || 0);
  const oldestPendingMs = Number(repositoryHealth?.oldestPendingMs || 0);
  if (queueDepth > repoQueueDepthWarning || oldestPendingMs > repoOldestPendingWarningMs) {
    alerts.push({
      code: "data_repository_persist_queue_backlog",
      severity: "warning",
      title: "Fila de persistência acumulada",
      description: "Persistências em background estão acumulando ou demorando para concluir.",
      since: nowIso,
      meta: {
        queueDepth,
        oldestPendingMs,
      },
    });
  }

  const lastPersistErrorAt = repositoryHealth?.lastPersistErrorAt
    ? new Date(repositoryHealth.lastPersistErrorAt).getTime()
    : null;
  if (Number.isFinite(lastPersistErrorAt)) {
    const ageMs = Date.now() - lastPersistErrorAt;
    if (ageMs >= 0 && ageMs <= recentPersistErrorWindowMs) {
      alerts.push({
        code: "data_repository_persist_error_recent",
        severity: "critical",
        title: "Erro recente na persistência",
        description:
          String(repositoryHealth?.lastPersistErrorMessage || "Falha recente ao persistir dados em background."),
        since: repositoryHealth?.lastPersistErrorAt || nowIso,
        meta: {
          label: repositoryHealth?.lastPersistErrorLabel || null,
        },
      });
    }
  }

  if (session?.usesDefaultSecretInProduction) {
    alerts.push({
      code: "session_secret_default_in_production",
      severity: "critical",
      title: "SESSION_SECRET inseguro em produção",
      description: "A aplicação está usando o secret fallback de sessão em produção.",
      since: nowIso,
    });
  }

  return sortOperationalAlerts(alerts);
};

export const buildOperationalAlertsResponse = ({ alerts, checks, generatedAt } = {}) => {
  const normalizedAlerts = sortOperationalAlerts(alerts);
  const safeChecks = Array.isArray(checks) ? checks : [];
  const statusFromChecks = deriveOverallStatusFromChecks(safeChecks);
  const statusFromAlerts = normalizedAlerts.some((item) => item.severity === "critical")
    ? "fail"
    : normalizedAlerts.some((item) => item.severity === "warning")
      ? "degraded"
      : "ok";
  const status = statusFromChecks === "fail" || statusFromAlerts === "fail"
    ? "fail"
    : statusFromChecks === "degraded" || statusFromAlerts === "degraded"
      ? "degraded"
      : "ok";
  return {
    ok: status !== "fail",
    status,
    generatedAt: String(generatedAt || new Date().toISOString()),
    alerts: normalizedAlerts,
    summary: summarizeOperationalAlerts(normalizedAlerts),
  };
};

