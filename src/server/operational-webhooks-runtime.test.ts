import { describe, expect, it, vi } from "vitest";

import { createOperationalWebhooksRuntime } from "../../server/lib/operational-webhooks-runtime.js";

const createDeps = (overrides = {}) => {
  const webhookStateStore = new Map();
  const integrationSettings = {
    operational: {
      enabled: true,
      provider: "discord",
      webhookUrl: "https://discord.com/api/webhooks/ops/token",
      timeoutMs: 5000,
      intervalMs: 45000,
    },
    security: {
      enabled: true,
      provider: "discord",
      webhookUrl: "https://discord.com/api/webhooks/security/token",
      timeoutMs: 5000,
    },
  };

  return {
    appendAuditLog: vi.fn(),
    buildOperationalAlertsWebhookNotification: ({ transition, dashboardUrl, generatedAt }) => ({
      transition,
      dashboardUrl,
      generatedAt,
    }),
    buildWebhookAuditMeta: (delivery, extra = {}) => ({
      deliveryId: delivery?.id || null,
      ...extra,
    }),
    buildWebhookTargetLabel: (url) => `target:${url}`,
    clampWebhookInteger: (value, min, max, fallback) => {
      const numeric = Math.floor(Number(value));
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      return Math.min(Math.max(numeric, min), max);
    },
    claimWebhookDelivery: vi
      .fn()
      .mockResolvedValueOnce({
        id: "delivery-1",
        scope: "security",
        provider: "discord",
        targetUrl: "https://discord.com/api/webhooks/security/token",
        payload: { content: "hello" },
        context: { timeoutMs: 3000 },
        attemptCount: 0,
        maxAttempts: 4,
      })
      .mockResolvedValueOnce(null),
    computeWebhookRetryDelayMs: () => 12_000,
    createRequestId: () => "uuid-1",
    createSystemAuditReq: () => ({
      headers: {},
      ip: "127.0.0.1",
      session: { user: { id: "system", name: "System" } },
      requestId: "system-req",
    }),
    createWebhookAuditReqFromContext: (context) => ({
      headers: {},
      ip: "127.0.0.1",
      session: { user: { id: "system", name: "System" } },
      requestId: `ctx-${String(context?.eventLabel || "webhook")}`,
    }),
    createWebhookWorkerId: () => "worker-1",
    diffOperationalAlertSets: () => ({
      triggered: [{ code: "db_unhealthy", severity: "critical" }],
      changed: [],
      resolved: [],
      hasChanges: true,
    }),
    dispatchWebhookMessage: vi.fn().mockResolvedValue({
      ok: true,
      status: "sent",
      statusCode: 204,
      body: Buffer.from([]),
      durationMs: 10,
    }),
    enqueueWebhookDelivery: vi
      .fn()
      .mockImplementation(({ scope, provider, webhookUrl, payload, context }) => ({
        ok: true,
        delivery: {
          id: `${scope}-delivery`,
          scope,
          provider,
          targetUrl: webhookUrl,
          payload,
          context,
        },
      })),
    evaluateOperationalMonitoring: vi.fn().mockResolvedValue({
      alerts: {
        alerts: [{ code: "db_unhealthy", severity: "critical" }],
        generatedAt: "2026-03-28T12:00:00.000Z",
      },
    }),
    loadIntegrationSettings: () => integrationSettings,
    loadWebhookState: (key) => webhookStateStore.get(key) || null,
    operationalWebhookIntervalDefaultMs: 60000,
    operationalWebhookIntervalMaxMs: 3600000,
    operationalWebhookIntervalMinMs: 10000,
    primaryAppOrigin: "https://example.com",
    resolveWebhookAuditActions: (scope) => ({
      queuedAction: `${scope}.queued`,
      sentAction: `${scope}.sent`,
      failedAction: `${scope}.failed`,
      resource: scope,
    }),
    toDiscordWebhookPayload: (notification) => ({
      embeds: [{ title: "Operational", description: JSON.stringify(notification) }],
    }),
    upsertWebhookDelivery: vi.fn((delivery) => delivery),
    webhookDeliveryScope: {
      OPS_ALERTS: "ops_alerts",
      SECURITY: "security",
    },
    webhookDeliveryStatus: {
      SENT: "sent",
      RETRYING: "retrying",
      FAILED: "failed",
    },
    writeWebhookState: vi.fn((key, data) => {
      webhookStateStore.set(key, { data });
      return { key, data };
    }),
    ...overrides,
  };
};

describe("operational-webhooks-runtime", () => {
  it("builds the security webhook payload with dashboard and event id", () => {
    const runtime = createOperationalWebhooksRuntime(createDeps());

    const payload = runtime.buildSecurityWebhookPayload({
      id: "evt-1",
      type: "security_event",
      status: "open",
      riskScore: 90,
      ts: "2026-03-28T12:00:00.000Z",
    });

    expect(payload.embeds?.[0]?.fields?.[0]?.value).toBe("https://example.com/dashboard");
    expect(payload.embeds?.[0]?.fields?.[1]?.value).toBe("evt-1");
  });

  it("processes queued deliveries through the worker tick", async () => {
    const deps = createDeps();
    const runtime = createOperationalWebhooksRuntime(deps);

    const result = await runtime.runWebhookDeliveryWorkerTick();

    expect(result).toEqual({ ok: true, processed: 1 });
    expect(deps.dispatchWebhookMessage).toHaveBeenCalledTimes(1);
    expect(deps.upsertWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delivery-1",
        status: "sent",
      }),
    );
  });

  it("schedules operational alert delivery and persists the new baseline", async () => {
    const deps = createDeps({
      claimWebhookDelivery: vi.fn().mockResolvedValue(null),
    });
    const runtime = createOperationalWebhooksRuntime(deps);

    const firstRun = await runtime.runOperationalAlertsSchedulerTick();
    const secondRun = await runtime.runOperationalAlertsSchedulerTick();

    expect(firstRun).toEqual({
      ok: true,
      delivery: expect.objectContaining({
        id: "ops_alerts-delivery",
      }),
    });
    expect(deps.writeWebhookState).toHaveBeenCalledTimes(1);
    expect(secondRun).toEqual({
      ok: false,
      status: "skipped",
      code: "not_due",
    });
  });
});
