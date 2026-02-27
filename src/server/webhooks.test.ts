import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchWebhookMessage } from "../../server/lib/webhooks/dispatcher.js";
import { toDiscordWebhookPayload } from "../../server/lib/webhooks/providers/discord.js";
import { buildOperationalAlertsWebhookNotification } from "../../server/lib/webhooks/templates/operational-alerts.js";
import { diffOperationalAlertSets } from "../../server/lib/webhooks/transitions.js";

describe("webhooks", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 204 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("detecta transicoes de alertas (triggered/changed/resolved)", () => {
    const transition = diffOperationalAlertSets({
      previousAlerts: [{ code: "a", severity: "warning", title: "A", description: "1" }],
      currentAlerts: [
        { code: "a", severity: "critical", title: "A", description: "2" },
        { code: "b", severity: "warning", title: "B", description: "3" },
      ],
    });

    expect(transition.hasChanges).toBe(true);
    expect(transition.changed.map((item) => item.code)).toContain("a");
    expect(transition.triggered.map((item) => item.code)).toContain("b");
    expect(transition.resolved).toHaveLength(0);
  });

  it("gera payload discord a partir de notificacao", () => {
    const notification = buildOperationalAlertsWebhookNotification({
      transition: {
        triggered: [{ code: "db_unhealthy", severity: "critical", title: "DB", description: "Falha" }],
        changed: [],
        resolved: [],
        hasChanges: true,
      },
      dashboardUrl: "https://example.com/dashboard",
      generatedAt: "2026-02-26T00:00:00.000Z",
    });
    const payload = toDiscordWebhookPayload(notification);

    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].title).toContain("Mudança");
    expect(payload.embeds[0].fields?.[0]?.name).toContain("Disparados");
  });

  it("envia webhook e retorna status sent", async () => {
    const result = await dispatchWebhookMessage({
      provider: "discord",
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      message: { embeds: [{ title: "x" }] },
      timeoutMs: 5000,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("sent");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retorna skipped sem url", async () => {
    const result = await dispatchWebhookMessage({
      provider: "discord",
      webhookUrl: "",
      message: { embeds: [] },
    });
    expect(result.status).toBe("skipped");
    expect(result.code).toBe("missing_webhook_url");
  });
});

