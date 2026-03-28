import { describe, expect, it, vi } from "vitest";

import { createWebhookDeliveryRuntime } from "../../server/lib/webhook-delivery-runtime.js";

const createDeps = (overrides = {}) => ({
  buildWebhookTargetLabel: (url) => `target:${url}`,
  clampWebhookInteger: (value, min, max, fallback) => {
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(Math.max(numeric, min), max);
  },
  createRequestId: () => "delivery-1",
  createWebhookAuditReqFromContextBase: (context, createRequestId) => ({
    requestId: createRequestId(),
    context,
  }),
  resolveWebhookAuditActionsBase: (scope, scopeConfig) => ({
    queuedAction: `${scopeConfig[scope]}.queued`,
    resource: scope,
  }),
  upsertWebhookDelivery: vi.fn((delivery) => delivery),
  validateWebhookUrlForProvider: ({ webhookUrl }) => ({
    ok: true,
    url: String(webhookUrl || "").trim(),
  }),
  webhookDeliveryScope: {
    EDITORIAL: "editorial",
    OPS_ALERTS: "ops_alerts",
  },
  webhookDeliveryStatus: {
    QUEUED: "queued",
  },
  ...overrides,
});

describe("webhook-delivery-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createWebhookDeliveryRuntime()).toThrow(/missing required dependencies/i);
  });

  it("builds audit helpers and enqueues normalized deliveries", () => {
    const deps = createDeps();
    const runtime = createWebhookDeliveryRuntime(deps);

    expect(runtime.createWebhookAuditReqFromContext({ eventLabel: "post" })).toEqual({
      requestId: "delivery-1",
      context: { eventLabel: "post" },
    });
    expect(runtime.resolveWebhookAuditActions("EDITORIAL")).toEqual({
      queuedAction: "editorial.queued",
      resource: "EDITORIAL",
    });

    const queued = runtime.enqueueWebhookDelivery({
      scope: "editorial",
      webhookUrl: "https://discord.com/api/webhooks/editorial/token",
      payload: { content: "hello" },
      timeoutMs: 9000,
      maxAttempts: 4,
      context: { eventLabel: "post_published" },
    });

    expect(queued).toEqual({
      ok: true,
      status: "queued",
      code: "queued",
      deliveryId: "delivery-1",
      delivery: expect.objectContaining({
        id: "delivery-1",
        status: "queued",
        targetUrl: "https://discord.com/api/webhooks/editorial/token",
        targetLabel: "target:https://discord.com/api/webhooks/editorial/token",
        maxAttempts: 4,
        context: expect.objectContaining({
          eventLabel: "post_published",
          timeoutMs: 9000,
        }),
      }),
    });
    expect(deps.upsertWebhookDelivery).toHaveBeenCalledTimes(1);
  });
});
