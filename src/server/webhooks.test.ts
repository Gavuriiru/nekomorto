import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("gera payload Discord a partir de notificação", () => {
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

  it("normaliza embed direto com author/thumbnail/image/footer icon", () => {
    const payload = toDiscordWebhookPayload({
      content: "Teste",
      allowedMentionsRoleIds: ["111", "abc", "111", "222"],
      embed: {
        title: "Título",
        description: "Descrição",
        footerText: "Rodapé",
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

  it("absolutiza URLs relativas com origin e filtra URLs inválidas", () => {
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
        footerText: "Rodapé",
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

  it("aceita placeholders novos e bloqueia placeholder inválido", () => {
    const settings = normalizeEditorialWebhookSettings({}, { projectTypes: ["Anime"] });
    settings.channels.posts.templates.post_create.content =
      "{{site.logoUrl}} {{mention.category}} {{mention.general}}";
    settings.channels.projects.templates.project_release.embed.imageUrl = "{{project.synopsis}}";
    settings.channels.projects.templates.project_adjust.embed.description = "{{chapter.synopsis}}";
    settings.channels.projects.templates.project_release.embed.fields = [
      { name: "Legado", value: "{{project.status}}", inline: true },
    ];
    expect(validateEditorialWebhookSettingsPlaceholders(settings).ok).toBe(true);

    const migrated = migrateEditorialMentionPlaceholdersInSettings(settings);
    expect(migrated.channels.posts.templates.post_create.content).toContain("{{mention.type}}");
    expect(migrated.channels.posts.templates.post_create.content).toContain("{{mention.release}}");
    expect(migrated.channels.posts.templates.post_create.content).not.toContain("{{mention.category}}");
    expect(migrated.channels.posts.templates.post_create.content).not.toContain("{{mention.general}}");

    settings.channels.posts.templates.post_create.content = "{{placeholder.inexistente}}";
    const validation = validateEditorialWebhookSettingsPlaceholders(settings);
    expect(validation.ok).toBe(false);
    expect(validation.errors[0]?.placeholder).toBe("placeholder.inexistente");
  });

  it("aplica menções por tipo + projeto + role global de lançamento", () => {
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
          thumbnailUrl: "{{project.cover}}",
          imageUrl: "{{project.banner}}",
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
          synopsis: "Sinopse do projeto",
        },
        chapter: { title: "Capítulo 1", synopsis: "Sinopse do capítulo" },
        site: { name: "Nekomata", logoUrl: "https://example.com/logo.png", url: "https://example.com" },
        author: { name: "Equipe", avatarUrl: "https://example.com/avatar.png" },
      },
    );

    expect(rendered.content).toBe("<@&999>");
    expect(rendered.embed.authorName).toBe("Equipe");
    expect(rendered.embed.thumbnailUrl).toBe("https://example.com/cover.jpg");
    expect(rendered.embed.imageUrl).toBe("https://example.com/banner.jpg");
    expect(rendered.embed.description).toContain("Sinopse do projeto");
    expect(rendered.embed.description).toContain("Sinopse do capítulo");
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

    const withoutSources = buildEditorialEventContext({
      origin: "https://example.com",
      project: { heroImageUrl: "" },
      chapter: { coverImageUrl: "" },
    });
    expect(withoutSources.chapter.coverImageUrl).toBe("");
  });
});

