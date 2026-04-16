const REQUIRED_DEPENDENCY_KEYS = [
  "backgroundJobQueue",
  "buildHealthStatusResponse",
  "buildOperationalAlertsResponse",
  "buildOperationalAlertsV1",
  "dataRepository",
  "dbLatencyWarningMs",
  "fsAccess",
  "fsConstants",
  "isMaintenanceMode",
  "isProduction",
  "prisma",
  "publicUploadsDir",
  "rateLimiter",
  "sessionCookieConfig",
];

const OPERATIONAL_PERSIST_ERROR_RECENT_WINDOW_MS = 15 * 60 * 1000;

const DEFAULT_REPOSITORY_HEALTH_SNAPSHOT = Object.freeze({
  queueDepth: 0,
  oldestPendingMs: 0,
  lastPersistStartedAt: null,
  lastPersistCompletedAt: null,
  lastPersistErrorAt: null,
  lastPersistErrorLabel: null,
  lastPersistErrorMessage: null,
});

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[operational-monitoring-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createOperationalMonitoringRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    backgroundJobQueue,
    buildHealthStatusResponse,
    buildOperationalAlertsResponse,
    buildOperationalAlertsV1,
    dataRepository,
    dbLatencyWarningMs,
    fsAccess,
    fsConstants,
    isMaintenanceMode,
    prisma,
    publicUploadsDir,
    rateLimiter,
    sessionCookieConfig,
  } = dependencies;

  const getRepositoryHealthSnapshot = () => {
    if (!dataRepository || typeof dataRepository.getHealthSnapshot !== "function") {
      return { ...DEFAULT_REPOSITORY_HEALTH_SNAPSHOT };
    }
    return dataRepository.getHealthSnapshot();
  };

  const buildMaintenanceHealthCheck = () => ({
    name: "maintenance_mode",
    status: isMaintenanceMode ? "warning" : "ok",
    message: isMaintenanceMode ? "Modo de manutenção ativo." : "Modo de manutenção desativado.",
  });

  const buildSessionConfigHealthCheck = () => ({
    name: "session_config",
    status: sessionCookieConfig.usesDefaultSecretInProduction ? "warning" : "ok",
    message: sessionCookieConfig.usesDefaultSecretInProduction
      ? "SESSION_SECRET fallback em produção."
      : "Configuração de sessão válida.",
    meta: {
      cookieName: sessionCookieConfig.name,
      secure: Boolean(sessionCookieConfig.cookie?.secure),
      sameSite: sessionCookieConfig.cookie?.sameSite || "lax",
      path: sessionCookieConfig.cookie?.path || "/",
    },
  });

  const buildRepositoryHealthCheck = () => {
    const snapshot = getRepositoryHealthSnapshot();
    const lastErrorTs = snapshot.lastPersistErrorAt
      ? new Date(snapshot.lastPersistErrorAt).getTime()
      : null;
    const hasRecentError =
      Number.isFinite(lastErrorTs) &&
      Date.now() - Number(lastErrorTs) <= OPERATIONAL_PERSIST_ERROR_RECENT_WINDOW_MS;
    const backlog =
      Number(snapshot.queueDepth || 0) > 10 || Number(snapshot.oldestPendingMs || 0) > 30_000;

    return {
      name: "data_repository",
      status: hasRecentError ? "warning" : backlog ? "warning" : "ok",
      message: hasRecentError
        ? "Houve erro recente na persistência em background."
        : backlog
          ? "Fila de persistência acumulada."
          : "Persistência em background saudável.",
      meta: snapshot,
    };
  };

  const buildBackgroundJobQueueHealthCheck = () => {
    const snapshot = backgroundJobQueue.snapshot();
    const maxRuntimeMs = Array.isArray(snapshot.activeJobs)
      ? snapshot.activeJobs.reduce((max, job) => Math.max(max, Number(job.runtimeMs || 0)), 0)
      : 0;
    const hasBacklog = Number(snapshot.pending || 0) > 20 || maxRuntimeMs > 120000;

    return {
      name: "background_jobs",
      status: hasBacklog ? "warning" : "ok",
      message: hasBacklog ? "Fila de jobs em atraso." : "Fila de jobs operacional.",
      meta: {
        pending: Number(snapshot.pending || 0),
        running: Number(snapshot.running || 0),
        maxRuntimeMs,
      },
    };
  };

  const buildRateLimiterHealthCheck = () => ({
    name: "rate_limit_backend",
    status: "ok",
    message: "Rate limit local em memoria.",
    meta: {
      mode: rateLimiter.mode,
    },
  });

  const probeDbHealthCheck = async () => {
    const startedAt = Date.now();
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      const latencyMs = Date.now() - startedAt;
      return {
        name: "database",
        status: latencyMs > dbLatencyWarningMs ? "warning" : "ok",
        latencyMs,
        message:
          latencyMs > dbLatencyWarningMs
            ? "Banco respondeu acima do limite de latência."
            : "Banco respondeu ao ping.",
      };
    } catch (error) {
      return {
        name: "database",
        status: "critical",
        latencyMs: Date.now() - startedAt,
        message: String(error?.message || error || "db_ping_failed"),
      };
    }
  };

  const probeUploadsDirHealthCheck = async () => {
    const startedAt = Date.now();
    try {
      await fsAccess(publicUploadsDir, fsConstants.R_OK | fsConstants.W_OK);
      return {
        name: "uploads_dir",
        status: "ok",
        latencyMs: Date.now() - startedAt,
        message: "Diretório de uploads acessível.",
        meta: { path: publicUploadsDir },
      };
    } catch (error) {
      return {
        name: "uploads_dir",
        status: "warning",
        latencyMs: Date.now() - startedAt,
        message: String(error?.message || error || "uploads_dir_unavailable"),
        meta: { path: publicUploadsDir },
      };
    }
  };

  const evaluateOperationalMonitoring = async () => {
    const dbCheck = await probeDbHealthCheck();
    const repositoryHealth = getRepositoryHealthSnapshot();
    const checks = [
      dbCheck,
      buildRepositoryHealthCheck(),
      buildBackgroundJobQueueHealthCheck(),
      buildRateLimiterHealthCheck(),
      await probeUploadsDirHealthCheck(),
      buildSessionConfigHealthCheck(),
      buildMaintenanceHealthCheck(),
    ];
    const health = buildHealthStatusResponse({
      checks,
      dataSource: dataRepository?.getDataSource?.() || "db",
      maintenanceMode: isMaintenanceMode,
      ts: new Date().toISOString(),
    });
    const alerts = buildOperationalAlertsV1({
      maintenanceMode: isMaintenanceMode,
      dbCheck,
      repositoryHealth,
      session: {
        usesDefaultSecretInProduction: sessionCookieConfig.usesDefaultSecretInProduction,
      },
      thresholds: {
        dbLatencyWarningMs: dbLatencyWarningMs,
      },
      now: health.ts,
    });
    const alertsResponse = buildOperationalAlertsResponse({
      alerts,
      checks: health.checks,
      generatedAt: health.ts,
    });

    return {
      ts: health.ts,
      checks: health.checks,
      health,
      alerts: alertsResponse,
      repositoryHealth,
      dbCheck,
    };
  };

  return {
    evaluateOperationalMonitoring,
    getRepositoryHealthSnapshot,
  };
};

export default createOperationalMonitoringRuntime;
