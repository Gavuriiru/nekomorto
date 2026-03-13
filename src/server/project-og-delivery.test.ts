import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOgRenderCache } from "../../server/lib/og-render-cache.js";

const buildProjectOgCardModelMock = vi.hoisted(() => vi.fn());
const buildProjectOgImageResponseMock = vi.hoisted(() => vi.fn());
const loadProjectOgArtworkDataUrlMock = vi.hoisted(() => vi.fn());
const loadProjectOgProcessedBackdropDataUrlMock = vi.hoisted(() => vi.fn());
const optimizeOgPublicImageBufferMock = vi.hoisted(() => vi.fn());
const resolveOgPublicImageEncodingConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/lib/project-og.js", () => ({
  PROJECT_OG_SCENE_VERSION: "project-og-v4",
  buildProjectOgCardModel: buildProjectOgCardModelMock,
  buildProjectOgImagePath: (projectId: string) =>
    `/api/og/project/${encodeURIComponent(String(projectId || "").trim())}`,
  buildProjectOgImageResponse: buildProjectOgImageResponseMock,
  loadProjectOgArtworkDataUrl: loadProjectOgArtworkDataUrlMock,
  loadProjectOgProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrlMock,
}));

vi.mock("../../server/lib/og-image-output.js", () => ({
  optimizeOgPublicImageBuffer: optimizeOgPublicImageBufferMock,
  resolveOgPublicImageEncodingConfig: resolveOgPublicImageEncodingConfigMock,
}));

import {
  buildProjectOgDeliveryHeaders,
  buildProjectOgRevision,
  buildVersionedProjectOgImagePath,
  getProjectOgCachedRender,
  prewarmProjectOgCache,
} from "../../server/lib/project-og-delivery.js";

const projectFixture = {
  id: "projeto-teste",
  title: "Projeto Teste",
  type: "Anime",
  status: "Finalizado",
  studio: "Studio Teste",
  cover: "/uploads/projeto/capa.jpg",
  banner: "/uploads/projeto/banner.jpg",
};

const settingsFixture = {
  theme: {
    accent: "#3173ff",
  },
};

const translationsFixture = {
  tags: {},
  genres: {},
};

const imageEncodingConfigFixture = {
  targetKb: 320,
  maxBytes: 320 * 1024,
  qualityLadder: [82, 78, 74],
};

describe("project og delivery", () => {
  beforeEach(() => {
    buildProjectOgCardModelMock.mockReset();
    buildProjectOgImageResponseMock.mockReset();
    loadProjectOgArtworkDataUrlMock.mockReset();
    loadProjectOgProcessedBackdropDataUrlMock.mockReset();
    optimizeOgPublicImageBufferMock.mockReset();
    resolveOgPublicImageEncodingConfigMock.mockReset();
    optimizeOgPublicImageBufferMock.mockImplementation(async ({ buffer }: { buffer?: Buffer }) => ({
      buffer: Buffer.from(`optimized:${Buffer.isBuffer(buffer) ? buffer.toString() : ""}`),
      contentType: "image/jpeg",
      format: "jpeg",
      quality: 80,
    }));
    resolveOgPublicImageEncodingConfigMock.mockReturnValue(imageEncodingConfigFixture);

    buildProjectOgCardModelMock.mockImplementation(
      ({ project, settings }: { project?: Record<string, unknown>; settings?: Record<string, unknown> }) => ({
        eyebrow: `${String(project?.type || "")} • ${String(project?.status || "")}`,
        title: String(project?.title || "Projeto"),
        subtitle: String(project?.studio || ""),
        sceneVersion: "project-og-v4",
        titleFontSize: 72,
        artworkUrl: String(project?.cover || ""),
        artworkSource: "cover",
        backdropUrl: String(project?.banner || ""),
        backdropSource: "banner",
        palette: {
          accentPrimary: String(settings?.theme?.accent || "#3173ff"),
          accentLine: "#3173ff",
          accentDarkStart: "#101820",
          accentDarkEnd: "#02050b",
          bgBase: "#02050b",
        },
        layout: {
          artworkLeft: 747,
          artworkTop: 0,
          artworkWidth: 453,
          artworkHeight: 630,
          dividerLeft: 744,
          dividerTop: 0,
          dividerWidth: 59,
          dividerHeight: 630,
        },
      }),
    );

    loadProjectOgArtworkDataUrlMock.mockImplementation(
      async ({ artworkUrl }: { artworkUrl?: string }) => `data:artwork:${String(artworkUrl || "")}`,
    );
    loadProjectOgProcessedBackdropDataUrlMock.mockImplementation(
      async ({ artworkUrl }: { artworkUrl?: string }) => `data:backdrop:${String(artworkUrl || "")}`,
    );
    buildProjectOgImageResponseMock.mockImplementation(
      ({
        title,
        artworkDataUrl,
        backdropDataUrl,
      }: {
        title?: string;
        artworkDataUrl?: string;
        backdropDataUrl?: string;
      }) => ({
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () =>
          Buffer.from(
            `${String(title || "")}|${String(artworkDataUrl || "")}|${String(backdropDataUrl || "")}`,
          ),
      }),
    );
  });

  it("builds a versioned project OG path", () => {
    expect(
      buildVersionedProjectOgImagePath({
        projectId: "projeto-teste",
        revision: "rev-123",
      }),
    ).toBe("/api/og/project/projeto-teste?v=rev-123");
  });

  it("changes project OG revision when the scene version changes", () => {
    const original = buildProjectOgRevision({
      project: projectFixture,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      sceneVersion: "project-og-v4",
    });
    const versionChanged = buildProjectOgRevision({
      project: projectFixture,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      sceneVersion: "project-og-v5",
    });

    expect(versionChanged).not.toBe(original);
  });

  it("returns a cache miss first, then a cache hit, with diagnostic headers", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });

    const first = await getProjectOgCachedRender({
      project: projectFixture,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const firstHeaders = buildProjectOgDeliveryHeaders({
      cacheHit: first.cacheHit,
      timings: first.timings,
    });

    const second = await getProjectOgCachedRender({
      project: projectFixture,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const secondHeaders = buildProjectOgDeliveryHeaders({
      cacheHit: second.cacheHit,
      timings: second.timings,
    });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(buildProjectOgImageResponseMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      sourceContentType: "image/png",
      targetFormat: "jpeg",
      profile: "visually-lossless",
      maxBytes: imageEncodingConfigFixture.maxBytes,
      qualityLadder: imageEncodingConfigFixture.qualityLadder,
    });
    expect(first.contentType).toBe("image/jpeg");
    expect(first.buffer.toString()).toContain("optimized:");
    expect(firstHeaders.cache).toBe("miss");
    expect(firstHeaders.serverTiming).toContain("cache_read;dur=");
    expect(firstHeaders.serverTiming).toContain("image_render;dur=");
    expect(firstHeaders.serverTiming).toContain("image_optimize;dur=");
    expect(firstHeaders.serverTiming).toContain("total;dur=");
    expect(secondHeaders.cache).toBe("hit");
    expect(secondHeaders.serverTiming).toContain("cache_read;dur=");
    expect(secondHeaders.serverTiming).toContain("total;dur=");
    expect(secondHeaders.serverTiming).not.toContain("image_render;dur=");
  });

  it("prewarms the project OG cache for subsequent requests", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });
    const secondProject = {
      ...projectFixture,
      id: "projeto-dois",
      title: "Projeto Dois",
    };

    const prewarm = await prewarmProjectOgCache({
      projects: [projectFixture, secondProject],
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });

    const warmedRequest = await getProjectOgCachedRender({
      project: projectFixture,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });

    expect(prewarm).toEqual({
      total: 2,
      warmed: 2,
      cacheHits: 0,
    });
    expect(buildProjectOgImageResponseMock).toHaveBeenCalledTimes(2);
    expect(warmedRequest.cacheHit).toBe(true);
  });
});
