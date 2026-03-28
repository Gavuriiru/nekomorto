import { describe, expect, it } from "vitest";

import {
  buildWebhookAuditMeta,
  clampWebhookInteger,
  createBuildEditorialWebhookImageContext,
  createResolveEditorialAuthorFromPost,
  createWebhookAuditReqFromContext,
  pickFirstNonEmptyText,
  resolveWebhookAuditActions,
} from "../../server/lib/webhook-support.js";

describe("webhook support", () => {
  it("resolves editorial author using active normalized user names", () => {
    const resolveEditorialAuthorFromPost = createResolveEditorialAuthorFromPost({
      loadUsers: () => [
        { name: "Autor Teste", avatarUrl: "/uploads/autor.jpg", status: "active" },
        { name: "Autor Teste", avatarUrl: "/uploads/inactive.jpg", status: "inactive" },
      ],
      normalizeTypeLookupKey: (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase(),
      normalizeUsers: (users) => users,
    });

    expect(resolveEditorialAuthorFromPost({ author: "Áutor Teste" })).toEqual({
      name: "Áutor Teste",
      avatarUrl: "/uploads/autor.jpg",
    });
    expect(resolveEditorialAuthorFromPost({ author: "" })).toEqual({
      name: "",
      avatarUrl: "",
    });
  });

  it("builds audit request and audit metadata with webhook context defaults", () => {
    expect(createWebhookAuditReqFromContext({}, () => "uuid-1")).toEqual({
      headers: {},
      ip: "127.0.0.1",
      session: { user: { id: "system", name: "System" } },
      requestId: "webhook-uuid-1",
    });

    expect(
      buildWebhookAuditMeta(
        {
          id: "delivery-1",
          scope: "editorial",
          channel: "posts",
          eventKey: "post_create",
          context: {
            eventLabel: "Novo post",
            postId: "post-1",
            projectId: "project-1",
          },
        },
        { attempt: 1 },
      ),
    ).toEqual({
      deliveryId: "delivery-1",
      scope: "editorial",
      channel: "posts",
      eventKey: "post_create",
      eventLabel: "Novo post",
      postId: "post-1",
      projectId: "project-1",
      securityEventId: null,
      attempt: 1,
    });
  });

  it("maps audit actions by scope and clamps integers", () => {
    const scope = { OPS_ALERTS: "ops", SECURITY: "security" };

    expect(resolveWebhookAuditActions("ops", scope).queuedAction).toBe("ops_alerts.webhook.queued");
    expect(resolveWebhookAuditActions("security", scope).resource).toBe("security");
    expect(resolveWebhookAuditActions("editorial", scope).failedAction).toBe(
      "editorial_webhook.failed",
    );
    expect(clampWebhookInteger("7.9", 1, 5, 2)).toBe(5);
    expect(clampWebhookInteger("abc", 1, 5, 2)).toBe(2);
    expect(pickFirstNonEmptyText("", "  ", "ok", "fallback")).toBe("ok");
  });

  it("builds editorial webhook image context with sensible fallbacks", () => {
    const buildEditorialWebhookImageContext = createBuildEditorialWebhookImageContext({
      buildPostOgRevision: () => "post-rev",
      buildProjectOgRevision: () => "project-rev",
      buildProjectReadingOgCardModel: () => ({
        chapterNumberResolved: 3,
        volumeResolved: 2,
      }),
      buildProjectReadingOgRevisionValue: () => "reading-rev",
      buildVersionedPostOgImagePath: ({ slug, revision }) => `/api/og/post/${slug}?v=${revision}`,
      buildVersionedProjectOgImagePath: ({ projectId, revision }) =>
        `/api/og/project/${projectId}?v=${revision}`,
      buildVersionedProjectReadingOgImagePath: ({ projectId, chapterNumber, volume, revision }) =>
        `/api/og/project/${projectId}/reading/${chapterNumber}?volume=${volume}&v=${revision}`,
      extractFirstImageFromPostContent: () => ({ coverImageUrl: "/uploads/body.jpg" }),
      primaryAppOrigin: "https://nekomata.moe",
      resolveMetaImageVariantUrl: (value) => value,
      resolvePostCover: () => ({ coverImageUrl: "/uploads/post-cover.jpg" }),
    });

    expect(
      buildEditorialWebhookImageContext({
        post: { slug: "post-1", content: "<p>x</p>", contentFormat: "html" },
        project: { id: "project-1", heroImageUrl: "/uploads/hero.jpg" },
        chapter: { number: 3, volume: 2, coverImageUrl: "/uploads/chapter.jpg" },
        settings: { site: { defaultShareImage: "/uploads/default.jpg" } },
        translations: { tags: {}, genres: {} },
      }),
    ).toEqual({
      postImageUrl: "/uploads/post-cover.jpg",
      postOgImageUrl: "/api/og/post/post-1?v=post-rev",
      projectImageUrl: "/uploads/hero.jpg",
      projectBackdropImageUrl: "/uploads/hero.jpg",
      projectOgImageUrl: "/api/og/project/project-1?v=project-rev",
      chapterImageUrl: "/uploads/chapter.jpg",
      chapterOgImageUrl: "/api/og/project/project-1/reading/3?volume=2&v=reading-rev",
    });
  });
});
