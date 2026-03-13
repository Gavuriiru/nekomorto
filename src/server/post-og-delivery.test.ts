import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOgRenderCache } from "../../server/lib/og-render-cache.js";

const buildPostOgCardModelMock = vi.hoisted(() => vi.fn());
const buildPostOgImageResponseMock = vi.hoisted(() => vi.fn());
const loadProjectOgArtworkDataUrlMock = vi.hoisted(() => vi.fn());
const loadProjectOgProcessedBackdropDataUrlMock = vi.hoisted(() => vi.fn());
const optimizeOgPublicImageBufferMock = vi.hoisted(() => vi.fn());
const resolveOgPublicImageEncodingConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/lib/post-og.js", () => ({
  buildPostOgCardModel: buildPostOgCardModelMock,
  buildPostOgImageResponse: buildPostOgImageResponseMock,
}));

vi.mock("../../server/lib/project-og.js", () => ({
  loadProjectOgArtworkDataUrl: loadProjectOgArtworkDataUrlMock,
  loadProjectOgProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrlMock,
}));

vi.mock("../../server/lib/og-image-output.js", () => ({
  optimizeOgPublicImageBuffer: optimizeOgPublicImageBufferMock,
  resolveOgPublicImageEncodingConfig: resolveOgPublicImageEncodingConfigMock,
}));

import { getPostOgCachedRender } from "../../server/lib/post-og-delivery.js";

const postFixture = {
  id: "post-1",
  slug: "post-teste",
  title: "Post de Teste",
  author: "Autora Teste",
  content: "<p>Conteudo</p>",
  contentFormat: "html",
};

const settingsFixture = {
  theme: {
    accent: "#3173ff",
  },
  site: {
    defaultShareImage: "/uploads/default-share.png",
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

describe("post og delivery", () => {
  beforeEach(() => {
    buildPostOgCardModelMock.mockReset();
    buildPostOgImageResponseMock.mockReset();
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

    buildPostOgCardModelMock.mockImplementation(
      ({
        post,
        settings,
      }: {
        post?: Record<string, unknown>;
        settings?: Record<string, unknown>;
      }) => ({
        eyebrow: "Postagem",
        title: String(post?.title || "Postagem"),
        subtitle: String(post?.author || ""),
        sceneVersion: "post-og-v2",
        artworkUrl: "/uploads/posts/post-1/cover.jpg",
        artworkSource: "post-cover",
        backdropUrl: "/uploads/posts/post-1/body.jpg",
        backdropSource: "post-first-image",
        subtitleAvatarUrl: "https://cdn.example.com/avatar.png",
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
    buildPostOgImageResponseMock.mockImplementation(
      ({
        title,
        artworkDataUrl,
        backdropDataUrl,
        subtitleAvatarDataUrl,
      }: {
        title?: string;
        artworkDataUrl?: string;
        backdropDataUrl?: string;
        subtitleAvatarDataUrl?: string;
      }) => ({
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () =>
          Buffer.from(
            [
              String(title || ""),
              String(artworkDataUrl || ""),
              String(backdropDataUrl || ""),
              String(subtitleAvatarDataUrl || ""),
            ].join("|"),
          ),
      }),
    );
  });

  it("renders and caches the optimized post OG buffer through conservative jpeg encoding", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });

    const first = await getPostOgCachedRender({
      post: postFixture,
      relatedProject: null,
      resolvedCover: { coverImageUrl: "/uploads/posts/post-1/cover.jpg", source: "manual" },
      firstPostImage: { coverImageUrl: "/uploads/posts/post-1/body.jpg" },
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
      defaultBackdropUrl: settingsFixture.site.defaultShareImage,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });

    const cached = cache.read(first.cacheKey);

    expect(first.cacheHit).toBe(false);
    expect(buildPostOgImageResponseMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      sourceContentType: "image/png",
      targetFormat: "jpeg",
      profile: "visually-lossless",
      maxBytes: imageEncodingConfigFixture.maxBytes,
      qualityLadder: imageEncodingConfigFixture.qualityLadder,
    });
    expect(cached?.contentType).toBe("image/jpeg");
    expect(first.contentType).toBe("image/jpeg");
    expect(first.buffer.toString()).toContain("optimized:");
    expect(Buffer.compare(Buffer.from(cached?.buffer || []), first.buffer)).toBe(0);
  });

  it("returns a cache hit on the second request with the same cached buffer", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });
    const request = {
      post: postFixture,
      relatedProject: null,
      resolvedCover: { coverImageUrl: "/uploads/posts/post-1/cover.jpg", source: "manual" },
      firstPostImage: { coverImageUrl: "/uploads/posts/post-1/body.jpg" },
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
      defaultBackdropUrl: settingsFixture.site.defaultShareImage,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    };

    const first = await getPostOgCachedRender(request);
    const second = await getPostOgCachedRender(request);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(buildPostOgImageResponseMock).toHaveBeenCalledTimes(1);
    expect(Buffer.compare(first.buffer, second.buffer)).toBe(0);
  });
});
