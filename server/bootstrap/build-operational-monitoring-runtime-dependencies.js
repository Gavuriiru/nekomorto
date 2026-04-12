export const buildOperationalMonitoringRuntimeDependencies = (dependencies = {}) => ({
  backgroundJobQueue: dependencies.backgroundJobQueue,
  buildHealthStatusResponse: dependencies.buildHealthStatusResponse,
  buildOperationalAlertsResponse: dependencies.buildOperationalAlertsResponse,
  buildOperationalAlertsV1: dependencies.buildOperationalAlertsV1,
  dataRepository: dependencies.dataRepository,
  dbLatencyWarningMs:
    dependencies.dbLatencyWarningMs ?? dependencies.OPS_ALERTS_DB_LATENCY_WARNING_MS,
  fsAccess:
    dependencies.fsAccess ??
    (dependencies.fs
      ? (targetPath, mode) => dependencies.fs.promises.access(targetPath, mode)
      : undefined),
  fsConstants: dependencies.fsConstants ?? dependencies.fs?.constants,
  isMaintenanceMode: dependencies.isMaintenanceMode,
  isProduction: dependencies.isProduction,
  prisma: dependencies.prisma,
  publicUploadsDir: dependencies.publicUploadsDir ?? dependencies.PUBLIC_UPLOADS_DIR,
  rateLimiter: dependencies.rateLimiter,
  redisUrl: dependencies.redisUrl ?? dependencies.REDIS_URL,
  sessionCookieConfig: dependencies.sessionCookieConfig,
});

export default buildOperationalMonitoringRuntimeDependencies;
