import { describe, expect, it, vi } from "vitest";

import { createEditorialWebhooksRuntime } from "../../server/lib/editorial-webhooks-runtime.js";

const createDeps = (overrides = {}) => {
  const appendAuditLog = vi.fn();
  const enqueueWebhookDelivery = vi.fn(() => ({
    ok: true,
    delivery: { id: "delivery-1", scope: "editorial" },
  }));
  const runWebhookDeliveryWorkerTick = vi.fn();

  return {
    appendAuditLog,
    buildEditorialEventContext: (context) => ({
      eventKey: context.eventKey,
      siteName: context.siteName,
      projectTitle: context.project?.title || "",
      chapterTitle: context.chapter?.title || "",
    }),
    buildEditorialMentions: () => ({
      roleIds: ["role-1"],
    }),
    buildEditorialWebhookImageContext: () => ({
      postImageUrl: "/post.png",
      postOgImageUrl: "/post-og.png",
      projectImageUrl: "/project.png",
      projectBackdropImageUrl: "/project-backdrop.png",
      projectOgImageUrl: "/project-og.png",
      chapterImageUrl: "/chapter.png",
      chapterOgImageUrl: "/chapter-og.png",
    }),
    buildWebhookAuditMeta: (delivery) => ({
      deliveryId: delivery?.id || null,
    }),
    buildWebhookTargetLabel: (url) => `target:${url}`,
    clampWebhookInteger: (value, min, max, fallback) => {
      const numeric = Math.floor(Number(value));
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      return Math.min(Math.max(numeric, min), max);
    },
    createSystemAuditReq: () => ({
      headers: {},
      ip: "127.0.0.1",
      requestId: "system-req",
      session: { user: { id: "system", name: "System" } },
    }),
    deriveChapterSynopsis: (chapter) => `synopsis:${String(chapter?.title || "")}`,
    enqueueWebhookDelivery,
    getActiveProjectTypes: () => ["light_novel"],
    getRequestIp: (req) => String(req?.ip || "").trim(),
    loadIntegrationSettings: () => ({
      editorial: {
        channels: {
          projects: {
            enabled: true,
            events: { project_release: true },
            webhookUrl: "https://discord.com/api/webhooks/editorial/token",
            timeoutMs: 7000,
            retries: 2,
            templates: {
              project_release: {
                id: "template-1",
              },
            },
          },
        },
      },
    }),
    loadProjects: () => [],
    loadSiteSettings: () => ({
      site: {
        name: "Nekomata",
        logoUrl: "/logo.png",
        defaultShareImage: "/share.png",
        faviconUrl: "/favicon.png",
      },
    }),
    loadTagTranslations: () => ({}),
    normalizeEditorialWebhookSettings: (settings) => settings,
    normalizeProjects: (projects) => projects,
    primaryAppOrigin: "https://example.com",
    renderWebhookTemplate: () => ({
      content: "Editorial payload",
      embed: {
        title: "Project release",
        description: "A new chapter is live",
        fields: [],
      },
    }),
    resolveEditorialAuthorFromPost: () => ({
      avatarUrl: "/author.png",
    }),
    resolveEditorialEventChannel: (eventKey) => (eventKey === "project_release" ? "projects" : ""),
    resolveEditorialEventLabel: (eventKey) => `label:${eventKey}`,
    resolveEpisodeLookup: () => ({
      ok: true,
      episode: {
        number: 12,
        volume: 3,
        title: "Chapter 12",
        content: "<p>Body</p>",
        releaseDate: "2026-03-28",
        chapterUpdatedAt: "2026-03-28T10:00:00.000Z",
        coverImageUrl: "/chapter-cover.png",
      },
    }),
    runWebhookDeliveryWorkerTick,
    toDiscordWebhookPayload: ({ content, embed, allowedMentionsRoleIds }) => ({
      content,
      embeds: [embed],
      allowedMentionsRoleIds,
    }),
    validateWebhookUrlForProvider: ({ webhookUrl }) => ({
      ok: true,
      url: String(webhookUrl || "").trim(),
    }),
    webhookDeliveryScope: {
      EDITORIAL: "editorial",
    },
    ...overrides,
  };
};

describe("editorial-webhooks-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createEditorialWebhooksRuntime()).toThrow(/missing required dependencies/i);
  });

  it("prepares project dispatch payloads and resolves chapters from the episode lookup", () => {
    const runtime = createEditorialWebhooksRuntime(createDeps());

    const chapter = runtime.findProjectChapterByEpisodeNumber({ id: "project-1" }, 12, 3);
    const prepared = runtime.prepareEditorialWebhookDispatch({
      eventKey: "project_release",
      project: {
        id: "project-1",
        title: "Example Project",
        type: "light_novel",
        discordRoleId: "role-1",
      },
      update: {
        episodeNumber: 12,
        volume: 3,
        updatedAt: "2026-03-28T11:00:00.000Z",
      },
    });

    expect(runtime.resolveProjectWebhookEventKey("Lançamento")).toBe("project_release");
    expect(chapter).toEqual(
      expect.objectContaining({
        number: 12,
        volume: 3,
        title: "Chapter 12",
        synopsis: "synopsis:Chapter 12",
      }),
    );
    expect(prepared).toEqual(
      expect.objectContaining({
        ok: true,
        channel: "projects",
        maxAttempts: 3,
        targetLabel: "target:https://discord.com/api/webhooks/editorial/token",
        payload: expect.objectContaining({
          content: "Editorial payload",
        }),
      }),
    );
  });

  it("queues editorial webhook deliveries and schedules the worker", async () => {
    const deps = createDeps();
    const runtime = createEditorialWebhooksRuntime(deps);

    const result = await runtime.dispatchEditorialWebhookEvent({
      eventKey: "project_release",
      project: {
        id: "project-1",
        title: "Example Project",
        type: "light_novel",
        discordRoleId: "role-1",
      },
      update: {
        episodeNumber: 12,
        volume: 3,
      },
      req: {
        headers: { "x-forwarded-for": "10.0.0.1" },
        ip: "127.0.0.1",
        requestId: "req-1",
        session: { user: { id: "user-1", name: "Editor" } },
      },
    });

    expect(deps.enqueueWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "editorial",
        eventKey: "project_release",
        maxAttempts: 3,
        context: expect.objectContaining({
          eventLabel: "label:project_release",
          actorId: "user-1",
          actorName: "Editor",
          actorIp: "127.0.0.1",
        }),
      }),
    );
    expect(deps.appendAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      "editorial_webhook.queued",
      "integrations",
      expect.objectContaining({
        deliveryId: "delivery-1",
        attempt: 0,
      }),
    );
    expect(deps.runWebhookDeliveryWorkerTick).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        channel: "projects",
        eventKey: "project_release",
      }),
    );
  });
});
