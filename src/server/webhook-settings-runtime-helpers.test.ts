import { describe, expect, it, vi } from "vitest";

import { createWebhookSettingsRuntimeHelpers } from "../../server/lib/webhook-settings-runtime-helpers.js";

describe("createWebhookSettingsRuntimeHelpers", () => {
  const createHelpers = () =>
    createWebhookSettingsRuntimeHelpers({
      createSecurityEventPayload: vi.fn((payload) => ({ ...payload, id: "security-event" })),
      crypto: { randomUUID: () => "uuid-123" },
      defaultOperationalWebhookSettings: vi.fn((payload) => ({ kind: "operational", ...payload })),
      defaultProjectTypeCatalog: [{ key: "manga" }],
      defaultSecurityWebhookSettings: vi.fn((payload) => ({ kind: "security", ...payload })),
      isOpsAlertsWebhookEnabled: true,
      migrateEditorialMentionPlaceholdersInSettings: vi.fn((value) => value),
      normalizeEditorialWebhookSettings: vi.fn((value) => value || {}),
      normalizeWebhookSettingsBundle: vi.fn((payload, options) => ({
        payload,
        options,
        settings: {
          ...payload,
          normalized: true,
        },
      })),
      opsAlertsWebhookIntervalMs: 15000,
      opsAlertsWebhookProvider: "discord",
      opsAlertsWebhookTimeoutMs: 5000,
      opsAlertsWebhookUrl: "https://discord.example/webhook",
      SecurityEventSeverity: { CRITICAL: "critical" },
      SecurityEventStatus: { OPEN: "open" },
      validateWebhookUrlForProvider: vi.fn(({ webhookUrl }) =>
        String(webhookUrl || "").includes("bad")
          ? { ok: false, code: "invalid_webhook_url", reason: "invalid_webhook_url" }
          : { ok: true },
      ),
    });

  it("builds env fallbacks and normalizes bundle requests", () => {
    const helpers = createHelpers();

    expect(helpers.buildEnvOperationalWebhookSettings()).toEqual({
      kind: "operational",
      enabled: true,
      provider: "discord",
      webhookUrl: "https://discord.example/webhook",
      timeoutMs: 5000,
      intervalMs: 15000,
    });

    const bundle = helpers.buildWebhookSettingsBundle({ editorial: { enabled: true } });
    expect(bundle.settings).toEqual({
      editorial: { enabled: true },
      normalized: true,
    });

    const normalized = helpers.normalizeUnifiedWebhookSettingsForRequest(
      { editorial: { enabled: false } },
      [{ key: "novel" }],
    );
    expect(normalized).toEqual({
      editorial: { enabled: false },
      normalized: true,
    });
  });

  it("returns a conflict response payload when revisions differ", () => {
    const helpers = createHelpers();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const result = helpers.ensureWebhookSettingsNoConflict({
      res: { status },
      currentSettings: { editorial: { enabled: true } },
      currentRevision: "rev-2",
      projectTypes: [{ key: "manga" }],
      sources: { operational: "env" },
      options: { ifRevision: "rev-1" },
    });

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: "edit_conflict",
      currentRevision: "rev-2",
      settings: { editorial: { enabled: true } },
      projectTypes: [{ key: "manga" }],
      sources: { operational: "env" },
    });
    expect(result).toBeUndefined();
  });

  it("validates unified webhook URLs across editorial, operational and security", () => {
    const helpers = createHelpers();

    const validation = helpers.validateUnifiedWebhookSettingsUrls({
      editorial: {
        channels: {
          posts: { webhookUrl: "https://bad.example/posts" },
          projects: { webhookUrl: "https://good.example/projects" },
        },
      },
      operational: {
        provider: "discord",
        webhookUrl: "https://good.example/ops",
      },
      security: {
        provider: "discord",
        webhookUrl: "https://bad.example/security",
      },
    });

    expect(validation).toEqual({
      ok: false,
      errors: [
        {
          channel: "posts",
          code: "invalid_webhook_url",
          reason: "invalid_webhook_url",
        },
        {
          channel: "security",
          code: "invalid_webhook_url",
          reason: "invalid_webhook_url",
        },
      ],
    });
  });

  it("builds deterministic test payloads for operational and security webhooks", () => {
    const helpers = createHelpers();

    expect(helpers.buildOperationalWebhookTestTransition()).toEqual({
      hasChanges: true,
      triggered: [
        {
          code: "webhook_test_alert",
          title: "Teste manual de webhook operacional",
          severity: "warning",
        },
      ],
      changed: [],
      resolved: [],
    });

    expect(helpers.buildSecurityWebhookTestEvent()).toEqual({
      id: "security-event",
      type: "integrations.webhooks.test",
      severity: "critical",
      riskScore: 90,
      status: "open",
      actorUserId: "system",
      requestId: "security-webhook-test-uuid-123",
      data: {
        source: "dashboard_webhooks_test",
      },
    });
  });
});
