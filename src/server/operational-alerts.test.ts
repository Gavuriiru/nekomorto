import { describe, expect, it } from "vitest";

import {
  buildOperationalAlertsResponse,
  buildOperationalAlertsV1,
  deriveOverallStatusFromChecks,
} from "../../server/lib/operational-alerts.js";

describe("operational-alerts", () => {
  it("gera alertas v1 a partir de sinais operacionais", () => {
    const alerts = buildOperationalAlertsV1({
      maintenanceMode: true,
      dbCheck: { status: "critical", message: "db down", latencyMs: 1200 },
      repositoryHealth: {
        queueDepth: 12,
        oldestPendingMs: 50000,
        lastPersistErrorAt: new Date().toISOString(),
        lastPersistErrorLabel: "posts",
        lastPersistErrorMessage: "boom",
      },
      session: { usesDefaultSecretInProduction: true },
      thresholds: { dbLatencyWarningMs: 1000 },
    });

    expect(alerts.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "maintenance_mode_enabled",
        "db_unhealthy",
        "data_repository_persist_queue_backlog",
        "data_repository_persist_error_recent",
        "session_secret_default_in_production",
      ]),
    );
  });

  it("deriva status geral a partir dos checks", () => {
    expect(deriveOverallStatusFromChecks([{ name: "a", status: "ok" }])).toBe("ok");
    expect(deriveOverallStatusFromChecks([{ name: "a", status: "warning" }])).toBe("degraded");
    expect(deriveOverallStatusFromChecks([{ name: "a", status: "critical" }])).toBe("fail");
  });

  it("monta resposta final de alertas com summary e status", () => {
    const response = buildOperationalAlertsResponse({
      alerts: [{ code: "db_unhealthy", severity: "critical", title: "DB", description: "x" }],
      checks: [{ name: "database", status: "critical" }],
      generatedAt: "2026-02-26T00:00:00.000Z",
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe("fail");
    expect(response.summary.critical).toBe(1);
    expect(response.checkFindings).toEqual([]);
    expect(response.checkSummary).toEqual({ total: 0, critical: 0, warning: 0 });
    expect(response.generatedAt).toBe("2026-02-26T00:00:00.000Z");
  });

  it("inclui checkFindings quando apenas checks explicam o degradado", () => {
    const response = buildOperationalAlertsResponse({
      alerts: [],
      checks: [
        {
          name: "background_jobs",
          status: "warning",
          message: "Fila de jobs em atraso.",
        },
      ],
      generatedAt: "2026-02-26T00:00:00.000Z",
    });

    expect(response.status).toBe("degraded");
    expect(response.checkSummary).toEqual({ total: 1, critical: 0, warning: 1 });
    expect(response.checkFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "background_jobs",
          severity: "warning",
          title: "Fila de jobs",
          description: "Fila de jobs em atraso.",
        }),
      ]),
    );
  });

  it("deduplica checkFinding quando alerta equivalente ja existe", () => {
    const response = buildOperationalAlertsResponse({
      alerts: [
        {
          code: "db_latency_high",
          severity: "warning",
          title: "Latencia alta no banco",
          description: "Ping acima do limite.",
        },
      ],
      checks: [
        { name: "database", status: "warning", message: "Banco respondeu acima do limite." },
      ],
    });

    expect(response.status).toBe("degraded");
    expect(response.checkFindings).toEqual([]);
    expect(response.checkSummary).toEqual({ total: 0, critical: 0, warning: 0 });
  });

  it("marca fail e inclui checkFinding critico sem alerta equivalente", () => {
    const response = buildOperationalAlertsResponse({
      alerts: [],
      checks: [{ name: "uploads_dir", status: "critical", message: "uploads_dir_unavailable" }],
    });

    expect(response.status).toBe("fail");
    expect(response.checkSummary).toEqual({ total: 1, critical: 1, warning: 0 });
    expect(response.checkFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "uploads_dir",
          severity: "critical",
          title: "Diretorio de uploads",
        }),
      ]),
    );
  });
});
