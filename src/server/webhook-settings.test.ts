import { describe, expect, it } from "vitest";

import { defaultEditorialWebhookSettings } from "../../server/lib/webhooks/editorial.js";
import {
  normalizeWebhookSettingsBundle,
  WEBHOOK_SETTINGS_VERSION,
} from "../../server/lib/webhooks/settings.js";

describe("webhook settings bundle", () => {
  it("migra payload editorial legado para envelope unificado com fallbacks de ambiente", () => {
    const editorial = defaultEditorialWebhookSettings(["Anime", "Manga"]);
    editorial.generalReleaseRoleId = "123";

    const result = normalizeWebhookSettingsBundle(editorial, {
      projectTypes: ["Anime", "Manga"],
      defaultProjectTypes: ["Anime", "Manga"],
      operationalFallback: {
        enabled: true,
        provider: "discord",
        webhookUrl: "https://discord.com/api/webhooks/ops/token",
        timeoutMs: 6000,
        intervalMs: 45000,
      },
      securityFallback: {
        enabled: true,
        provider: "discord",
        webhookUrl: "https://discord.com/api/webhooks/security/token",
        timeoutMs: 7000,
      },
    });

    expect(result.settings.version).toBe(WEBHOOK_SETTINGS_VERSION);
    expect(result.settings.editorial.generalReleaseRoleId).toBe("123");
    expect(result.settings.operational.webhookUrl).toBe(
      "https://discord.com/api/webhooks/ops/token",
    );
    expect(result.settings.security.webhookUrl).toBe(
      "https://discord.com/api/webhooks/security/token",
    );
    expect(result.sources).toEqual({
      editorial: "stored",
      operational: "env",
      security: "env",
    });
  });

  it("preserva blocos operational e security persistidos no envelope v2", () => {
    const result = normalizeWebhookSettingsBundle(
      {
        version: 2,
        editorial: defaultEditorialWebhookSettings(["Anime"]),
        operational: {
          enabled: true,
          provider: "discord",
          webhookUrl: "https://discord.com/api/webhooks/ops/stored",
          timeoutMs: 9000,
          intervalMs: 120000,
        },
        security: {
          enabled: true,
          provider: "discord",
          webhookUrl: "https://discord.com/api/webhooks/security/stored",
          timeoutMs: 8000,
        },
      },
      {
        projectTypes: ["Anime"],
        defaultProjectTypes: ["Anime"],
        operationalFallback: {},
        securityFallback: {},
      },
    );

    expect(result.settings.operational.webhookUrl).toBe(
      "https://discord.com/api/webhooks/ops/stored",
    );
    expect(result.settings.security.webhookUrl).toBe(
      "https://discord.com/api/webhooks/security/stored",
    );
    expect(result.sources).toEqual({
      editorial: "stored",
      operational: "stored",
      security: "stored",
    });
  });

  it("aplica clamp de timeout e intervalo nos blocos novos", () => {
    const result = normalizeWebhookSettingsBundle(
      {
        version: 2,
        editorial: defaultEditorialWebhookSettings(["Anime"]),
        operational: {
          enabled: true,
          provider: "discord",
          webhookUrl: "https://discord.com/api/webhooks/ops/stored",
          timeoutMs: 999999,
          intervalMs: 1,
        },
        security: {
          enabled: true,
          provider: "discord",
          webhookUrl: "https://discord.com/api/webhooks/security/stored",
          timeoutMs: 1,
        },
      },
      {
        projectTypes: ["Anime"],
        defaultProjectTypes: ["Anime"],
        operationalFallback: {},
        securityFallback: {},
      },
    );

    expect(result.settings.operational.timeoutMs).toBe(30000);
    expect(result.settings.operational.intervalMs).toBe(10000);
    expect(result.settings.security.timeoutMs).toBe(1000);
  });
});
