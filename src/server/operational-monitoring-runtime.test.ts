import { describe, expect, it, vi } from "vitest";

import { createOperationalMonitoringRuntime } from "../../server/lib/operational-monitoring-runtime.js";

const createDeps = (overrides = {}) => ({
  backgroundJobQueue: {
    snapshot: () => ({
      pending: 0,
      running: 1,
      activeJobs: [{ runtimeMs: 25 }],
    }),
  },
  buildHealthStatusResponse: ({ checks, dataSource, maintenanceMode, ts }) => ({
    checks,
    dataSource,
    maintenanceMode,
    ts,
  }),
  buildOperationalAlertsResponse: ({ alerts, checks, generatedAt }) => ({
    alerts,
    checks,
    generatedAt,
  }),
  buildOperationalAlertsV1: vi.fn(() => [{ code: "db_warning" }]),
  dataRepository: {
    getDataSource: () => "db",
    getHealthSnapshot: () => ({
      queueDepth: 2,
      oldestPendingMs: 250,
      lastPersistStartedAt: null,
      lastPersistCompletedAt: null,
      lastPersistErrorAt: null,
      lastPersistErrorLabel: null,
      lastPersistErrorMessage: null,
    }),
  },
  dbLatencyWarningMs: 10,
  fsAccess: vi.fn().mockResolvedValue(undefined),
  fsConstants: {
    R_OK: 4,
    W_OK: 2,
  },
  isMaintenanceMode: false,
  isProduction: true,
  prisma: {
    $queryRawUnsafe: vi.fn().mockResolvedValue(1),
  },
  publicUploadsDir: "uploads",
  rateLimiter: {
    mode: "memory",
  },
  redisUrl: "",
  sessionCookieConfig: {
    name: "sid",
    usesDefaultSecretInProduction: true,
    cookie: {
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  },
  ...overrides,
});

describe("operational-monitoring-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createOperationalMonitoringRuntime()).toThrow(/missing required dependencies/i);
  });

  it("builds the monitoring snapshot with warning checks and alerts", async () => {
    const deps = createDeps();
    const runtime = createOperationalMonitoringRuntime(deps);

    const snapshot = await runtime.evaluateOperationalMonitoring();

    expect(snapshot.repositoryHealth.queueDepth).toBe(2);
    expect(snapshot.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "database" }),
        expect.objectContaining({
          name: "rate_limit_backend",
          status: "warning",
        }),
        expect.objectContaining({
          name: "session_config",
          status: "warning",
        }),
      ]),
    );
    expect(deps.buildOperationalAlertsV1).toHaveBeenCalledWith(
      expect.objectContaining({
        thresholds: { dbLatencyWarningMs: 10 },
      }),
    );
    expect(snapshot.alerts.alerts).toEqual([{ code: "db_warning" }]);
  });

  it("falls back to a warning upload check and default repository snapshot", async () => {
    const runtime = createOperationalMonitoringRuntime(
      createDeps({
        dataRepository: null,
        fsAccess: vi.fn().mockRejectedValue(new Error("unavailable")),
        prisma: {
          $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("db down")),
        },
      }),
    );

    const snapshot = await runtime.evaluateOperationalMonitoring();

    expect(snapshot.repositoryHealth).toEqual(
      expect.objectContaining({
        queueDepth: 0,
        oldestPendingMs: 0,
      }),
    );
    expect(snapshot.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "database",
          status: "critical",
        }),
        expect.objectContaining({
          name: "uploads_dir",
          status: "warning",
        }),
      ]),
    );
  });
});
