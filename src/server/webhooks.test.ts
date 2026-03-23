import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeWebhookRetryDelayMs } from "../../server/lib/webhooks/delivery.js";
import { dispatchWebhookMessage } from "../../server/lib/webhooks/dispatcher.js";
import {
  buildEditorialEventContext,
  buildEditorialMentions,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeEditorialWebhookSettings,
  renderWebhookTemplate,
  validateEditorialWebhookSettingsPlaceholders,
} from "../../server/lib/webhooks/editorial.js";
import { toDiscordWebhookPayload } from "../../server/lib/webhooks/providers/discord.js";
import { buildOperationalAlertsWebhookNotification } from "../../server/lib/webhooks/templates/operational-alerts.js";
import { diffOperationalAlertSets } from "../../server/lib/webhooks/transitions.js";
import { validateWebhookUrlForProvider } from "../../server/lib/webhooks/validation.js";

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

  it("gera payload Discord a partir de notificacao", () => {
    const notification = buildOperationalAlertsWebhookNotification({
      transition: {
        triggered: [
          { code: "db_unhealthy", severity: "critical", title: "DB", description: "Falha" },
        ],
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

  it("trata 429 como retryavel e respeita Retry-After", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "7" }),
      text: async () => "rate limited",
    })) as unknown as typeof fetch;

    const result = await dispatchWebhookMessage({
      provider: "discord",
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      message: { embeds: [{ title: "x" }] },
      retries: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(7_000);
    expect(result.statusCode).toBe(429);
  });

  it("marca erro de rede como retryavel", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;

    const result = await dispatchWebhookMessage({
      provider: "discord",
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      message: { embeds: [{ title: "x" }] },
      retries: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("network_error");
    expect(result.retryable).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("valida URL de webhook Discord no backend", () => {
    expect(
      validateWebhookUrlForProvider({
        provider: "discord",
        webhookUrl: "https://discord.com/api/webhooks/123/abc",
      }),
    ).toMatchObject({
      ok: true,
      host: "discord.com",
    });

    expect(
      validateWebhookUrlForProvider({
        provider: "discord",
        webhookUrl: "http://discord.com/api/webhooks/123/abc",
      }),
    ).toMatchObject({
      ok: false,
      code: "invalid_webhook_url",
      reason: "invalid_protocol",
    });

    expect(
      validateWebhookUrlForProvider({
        provider: "discord",
        webhookUrl: "https://example.com/api/webhooks/123/abc",
      }),
    ).toMatchObject({
      ok: false,
      code: "invalid_webhook_url",
      reason: "unsupported_host",
    });
  });

  it("calcula backoff usando Retry-After quando presente", () => {
    expect(computeWebhookRetryDelayMs({ attemptCount: 3, retryAfterMs: 12_000 })).toBe(12_000);
  });

  it("normaliza embed direto com author/thumbnail/image/footer icon", () => {
    const payload = toDiscordWebhookPayload({
      content: "Teste",
      allowedMentionsRoleIds: ["111", "abc", "111", "222"],
      embed: {
        title: "Titulo",
        description: "Descricao",
        footerText: "Rodape",
        footerIconUrl: "https://example.com/footer.png",
        authorName: "Autor",
        authorIconUrl: "https://example.com/author.png",
        authorUrl: "https://example.com/author",
        thumbnailUrl: "https://example.com/thumb.png",
        imageUrl: "https://example.com/image.png",
      },
    });

    const embed = payload.embeds?.[0];
    expect(embed?.author?.name).toBe("Autor");
    expect(embed?.author?.icon_url).toBe("https://example.com/author.png");
    expect(embed?.thumbnail?.url).toBe("https://example.com/thumb.png");
    expect(embed?.image?.url).toBe("https://example.com/image.png");
    expect(embed?.footer?.icon_url).toBe("https://example.com/footer.png");
    expect(payload.allowed_mentions?.parse).toEqual([]);
    expect(payload.allowed_mentions?.roles).toEqual(["111", "222"]);
  });

  it("absolutiza URLs relativas com origin e filtra URLs invalidas", () => {
    const payload = toDiscordWebhookPayload({
      origin: "https://dev.nekomata.moe",
      embed: {
        title: "Teste",
        url: "/projeto/projeto-x",
        authorName: "Equipe",
        authorUrl: "javascript:alert(1)",
        authorIconUrl: "/uploads/avatars/equipe.png",
        thumbnailUrl: "/placeholder.svg",
        imageUrl: "javascript:alert(1)",
        footerText: "Rodape",
        footerIconUrl: "/uploads/branding/logo.png",
      },
    });

    const embed = payload.embeds?.[0];
    expect(embed?.url).toBe("https://dev.nekomata.moe/projeto/projeto-x");
    expect(embed?.author?.name).toBe("Equipe");
    expect(embed?.author?.url).toBeUndefined();
    expect(embed?.author?.icon_url).toBe("https://dev.nekomata.moe/uploads/avatars/equipe.png");
    expect(embed?.thumbnail?.url).toBe("https://dev.nekomata.moe/placeholder.svg");
    expect(embed?.image).toBeUndefined();
    expect(embed?.footer?.icon_url).toBe("https://dev.nekomata.moe/uploads/branding/logo.png");
  });

  it("trunca payloads Discord para limites conhecidos", () => {
    const payload = toDiscordWebhookPayload({
      content: "c".repeat(2_500),
      embed: {
        title: "t".repeat(400),
        description: "d".repeat(5_000),
        footerText: "f".repeat(2_500),
        authorName: "a".repeat(400),
        fields: [{ name: "n".repeat(400), value: "v".repeat(1_500), inline: false }],
      },
    });

    const embed = payload.embeds?.[0];
    const totalEmbedTextLength = [
      embed?.title || "",
      embed?.description || "",
      embed?.footer?.text || "",
      embed?.author?.name || "",
      ...(embed?.fields || []).flatMap((field) => [field.name || "", field.value || ""]),
    ].reduce((total, text) => total + text.length, 0);

    expect(payload.content?.length || 0).toBeLessThanOrEqual(2_000);
    expect(embed?.title?.length || 0).toBeLessThanOrEqual(256);
    expect(embed?.description?.length || 0).toBeLessThanOrEqual(4_096);
    expect(embed?.footer?.text?.length || 0).toBeLessThanOrEqual(2_048);
    expect(embed?.author?.name?.length || 0).toBeLessThanOrEqual(256);
    expect(embed?.fields?.[0]?.name?.length || 0).toBeLessThanOrEqual(256);
    expect(embed?.fields?.[0]?.value?.length || 0).toBeLessThanOrEqual(1_024);
    expect(totalEmbedTextLength).toBeLessThanOrEqual(6_000);
  });

  it("resume alertas operacionais sem estourar o campo do Discord", () => {
    const notification = buildOperationalAlertsWebhookNotification({
      transition: {
        triggered: Array.from({ length: 80 }, (_, index) => ({
          code: `alert_${index}`,
          severity: "warning",
          title: `Alerta ${index} com um titulo propositalmente maior para forcar truncamento`,
          description: `Descricao ${index}`,
        })),
        changed: [],
        resolved: [],
        hasChanges: true,
      },
    });

    expect(notification.fields?.[0]?.value).toContain("restante(s)");
    expect(notification.fields?.[0]?.value.length || 0).toBeLessThanOrEqual(920);
  });

  it("migra categories/typeMappings legado para typeRoles", () => {
    const settings = normalizeEditorialWebhookSettings(
      {
        categories: [{ id: "anime", label: "Anime", roleId: "123", enabled: true, order: 0 }],
        typeMappings: [{ type: "Anime", categoryId: "anime" }],
      },
      { projectTypes: ["Anime"] },
    );

    expect(settings.typeRoles).toEqual([
      {
        type: "Anime",
        roleId: "123",
        enabled: true,
        order: 0,
      },
    ]);
  });

  it("aceita placeholders novos e bloqueia placeholder invalido", () => {
    const settings = normalizeEditorialWebhookSettings({}, { projectTypes: ["Anime"] });
    settings.channels.posts.templates.post_create.content =
      "{{site.logoUrl}} {{mention.category}} {{mention.general}}";
    settings.channels.posts.templates.post_create.embed.thumbnailUrl = "{{post.imageUrl}}";
    settings.channels.posts.templates.post_update.embed.imageUrl = "{{project.backdropImageUrl}}";
    settings.channels.posts.templates.post_update.embed.description =
      "{{post.excerpt}} {{post.ogImageUrl}}";
    settings.channels.projects.templates.project_release.embed.thumbnailUrl =
      "{{project.imageUrl}}";
    settings.channels.projects.templates.project_release.embed.imageUrl = "{{chapter.imageUrl}}";
    settings.channels.projects.templates.project_adjust.embed.description =
      "{{chapter.synopsis}} {{chapter.ogImageUrl}} {{project.ogImageUrl}}";
    settings.channels.projects.templates.project_release.embed.fields = [
      { name: "Legado", value: "{{project.status}}", inline: true },
    ];
    expect(validateEditorialWebhookSettingsPlaceholders(settings).ok).toBe(true);

    const migrated = migrateEditorialMentionPlaceholdersInSettings(settings);
    expect(migrated.channels.posts.templates.post_create.content).toContain("{{mention.type}}");
    expect(migrated.channels.posts.templates.post_create.content).toContain("{{mention.release}}");
    expect(migrated.channels.posts.templates.post_create.content).not.toContain(
      "{{mention.category}}",
    );
    expect(migrated.channels.posts.templates.post_create.content).not.toContain(
      "{{mention.general}}",
    );

    settings.channels.posts.templates.post_create.content = "{{placeholder.inexistente}}";
    const validation = validateEditorialWebhookSettingsPlaceholders(settings);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]?.placeholder).toBe("placeholder.inexistente");
  });

  it("aplica mencoes por tipo + projeto + role global de lancamento", () => {
    const settings = normalizeEditorialWebhookSettings(
      {
        generalReleaseRoleId: "999",
        typeRoles: [{ type: "Anime", roleId: "111", enabled: true, order: 0 }],
      },
      { projectTypes: ["Anime"] },
    );

    const mentions = buildEditorialMentions({
      settings,
      eventKey: "project_release",
      projectType: "Anime",
      projectDiscordRoleId: "222",
      includeProjectRole: true,
    });

    expect(mentions.roleIds).toEqual(["111", "222", "999"]);
    expect(mentions.releaseMention).toBe("<@&999>");
    expect(mentions.typeMention).toBe("<@&111>");
    expect(mentions.projectMention).toBe("<@&222>");

    const adjustMentions = buildEditorialMentions({
      settings,
      eventKey: "project_adjust",
      projectType: "Anime",
      projectDiscordRoleId: "222",
      includeProjectRole: true,
    });
    expect(adjustMentions.releaseMention).toBe("");
    expect(adjustMentions.roleIds).toEqual(["111", "222"]);
  });

  it("renderiza template estendido com author/thumbnail/image/synopsis", () => {
    const rendered = renderWebhookTemplate(
      {
        content: "{{mention.release}}",
        embed: {
          title: "{{project.title}}",
          description: "{{project.synopsis}} - {{chapter.synopsis}}",
          footerText: "{{site.name}}",
          footerIconUrl: "{{site.logoUrl}}",
          url: "{{project.url}}",
          color: "#112233",
          authorName: "{{author.name}}",
          authorIconUrl: "{{author.avatarUrl}}",
          authorUrl: "{{site.url}}",
          thumbnailUrl: "{{project.imageUrl}}",
          imageUrl: "{{chapter.imageUrl}}",
          fields: [],
        },
      },
      {
        mention: { release: "<@&999>" },
        project: {
          title: "Projeto X",
          url: "https://example.com/projeto-x",
          cover: "https://example.com/cover.jpg",
          banner: "https://example.com/banner.jpg",
          imageUrl: "https://example.com/project-image.jpg",
          synopsis: "Sinopse do projeto",
        },
        chapter: {
          title: "Capitulo 1",
          synopsis: "Sinopse do capitulo",
          imageUrl: "https://example.com/chapter-image.jpg",
        },
        site: {
          name: "Nekomata",
          logoUrl: "https://example.com/logo.png",
          url: "https://example.com",
        },
        author: { name: "Equipe", avatarUrl: "https://example.com/avatar.png" },
      },
    );

    expect(rendered.content).toBe("<@&999>");
    expect(rendered.embed.authorName).toBe("Equipe");
    expect(rendered.embed.thumbnailUrl).toBe("https://example.com/project-image.jpg");
    expect(rendered.embed.imageUrl).toBe("https://example.com/chapter-image.jpg");
    expect(rendered.embed.description).toContain("Sinopse do projeto");
    expect(rendered.embed.description).toContain("Sinopse do capitulo");
  });

  it("aplica fallback de chapter.coverImageUrl para project.heroImageUrl no contexto", () => {
    const withChapterCover = buildEditorialEventContext({
      origin: "https://example.com",
      project: { heroImageUrl: "https://example.com/hero.jpg" },
      chapter: { coverImageUrl: "https://example.com/chapter.jpg" },
    });
    expect(withChapterCover.chapter.coverImageUrl).toBe("https://example.com/chapter.jpg");

    const withHeroFallback = buildEditorialEventContext({
      origin: "https://example.com",
      project: { heroImageUrl: "https://example.com/hero.jpg" },
      chapter: { coverImageUrl: "   " },
    });
    expect(withHeroFallback.chapter.coverImageUrl).toBe("https://example.com/hero.jpg");
    expect(withHeroFallback.chapter.imageUrl).toBe("https://example.com/hero.jpg");

    const withoutSources = buildEditorialEventContext({
      origin: "https://example.com",
      project: { heroImageUrl: "" },
      chapter: { coverImageUrl: "" },
    });
    expect(withoutSources.chapter.coverImageUrl).toBe("");
    expect(withoutSources.chapter.imageUrl).toBe("/placeholder.svg");
  });

  it("resolve placeholders de imagem e og com fallback explicito", () => {
    const context = buildEditorialEventContext({
      origin: "https://example.com",
      siteCoverImageUrl: "https://example.com/site-cover.jpg",
      post: {
        coverImageUrl: "",
      },
      project: {
        cover: "",
        heroImageUrl: "https://example.com/project-hero.jpg",
        banner: "https://example.com/project-banner.jpg",
      },
      chapter: {
        coverImageUrl: "",
      },
      postOgImageUrl: "https://example.com/post-og.jpg",
      projectOgImageUrl: "https://example.com/project-og.jpg",
      chapterOgImageUrl: "",
    });

    expect(context.post.ogImageUrl).toBe("https://example.com/post-og.jpg");
    expect(context.post.imageUrl).toBe("https://example.com/post-og.jpg");
    expect(context.project.ogImageUrl).toBe("https://example.com/project-og.jpg");
    expect(context.project.imageUrl).toBe("https://example.com/project-hero.jpg");
    expect(context.project.backdropImageUrl).toBe("https://example.com/project-banner.jpg");
    expect(context.chapter.ogImageUrl).toBe("https://example.com/project-og.jpg");
    expect(context.chapter.imageUrl).toBe("https://example.com/project-hero.jpg");
  });

  it("cai para a imagem padrao do site e depois para /placeholder.svg", () => {
    const withSiteFallback = buildEditorialEventContext({
      origin: "https://example.com",
      siteCoverImageUrl: "https://example.com/site-cover.jpg",
      post: {},
      project: {},
      chapter: {},
    });
    expect(withSiteFallback.post.imageUrl).toBe("https://example.com/site-cover.jpg");
    expect(withSiteFallback.project.imageUrl).toBe("https://example.com/site-cover.jpg");
    expect(withSiteFallback.chapter.imageUrl).toBe("https://example.com/site-cover.jpg");

    const withPlaceholderFallback = buildEditorialEventContext({
      origin: "https://example.com",
      post: {},
      project: {},
      chapter: {},
    });
    expect(withPlaceholderFallback.post.imageUrl).toBe("/placeholder.svg");
    expect(withPlaceholderFallback.project.backdropImageUrl).toBe("/placeholder.svg");
    expect(withPlaceholderFallback.chapter.imageUrl).toBe("/placeholder.svg");
  });
});
