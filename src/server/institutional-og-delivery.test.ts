import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOgRenderCache } from "../../server/lib/og-render-cache.js";

const buildInstitutionalOgCardModelMock = vi.hoisted(() => vi.fn());
const buildInstitutionalOgImageResponseMock = vi.hoisted(() => vi.fn());
const loadInstitutionalOgBackgroundDataUrlMock = vi.hoisted(() => vi.fn());
const optimizeOgPublicImageBufferMock = vi.hoisted(() => vi.fn());
const resolveOgPublicImageEncodingConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/lib/institutional-og.js", () => ({
  buildInstitutionalOgCardModel: buildInstitutionalOgCardModelMock,
  buildInstitutionalOgImageResponse: buildInstitutionalOgImageResponseMock,
  loadInstitutionalOgBackgroundDataUrl: loadInstitutionalOgBackgroundDataUrlMock,
}));

vi.mock("../../server/lib/og-image-output.js", () => ({
  optimizeOgPublicImageBuffer: optimizeOgPublicImageBufferMock,
  resolveOgPublicImageEncodingConfig: resolveOgPublicImageEncodingConfigMock,
}));

import {
  buildInstitutionalOgDeliveryHeaders,
  buildInstitutionalOgRevisionValue,
  buildVersionedInstitutionalOgImagePath,
  getInstitutionalOgCachedRender,
} from "../../server/lib/institutional-og-delivery.js";
import { resolveInstitutionalOgPageKeyFromPath } from "../../shared/institutional-og-seo.js";

const settingsFixture = {
  theme: {
    accent: "#3173ff",
  },
  site: {
    name: "Nekomata",
    description: "Descricao do site",
    defaultShareImage: "/uploads/default-og.jpg",
  },
};

const pagesFixture = {
  projects: {
    shareImage: "/uploads/projects.jpg",
    shareImageAlt: "Projetos",
  },
  about: {
    shareImage: "/uploads/about.jpg",
    shareImageAlt: "Sobre",
    heroSubtitle: "Conheca a fansub.",
  },
  donations: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Ajude o projeto.",
  },
  faq: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Perguntas frequentes.",
  },
  team: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Conheca a equipe.",
  },
  recruitment: {
    shareImage: "",
    shareImageAlt: "",
    heroSubtitle: "Venha ajudar.",
  },
};

const imageEncodingConfigFixture = {
  targetKb: 320,
  maxBytes: 320 * 1024,
  qualityLadder: [82, 78, 74],
};

describe("institutional og delivery", () => {
  beforeEach(() => {
    buildInstitutionalOgCardModelMock.mockReset();
    buildInstitutionalOgImageResponseMock.mockReset();
    loadInstitutionalOgBackgroundDataUrlMock.mockReset();
    optimizeOgPublicImageBufferMock.mockReset();
    resolveOgPublicImageEncodingConfigMock.mockReset();
    optimizeOgPublicImageBufferMock.mockImplementation(async ({ buffer }: { buffer?: Buffer }) => ({
      buffer: Buffer.from(`optimized:${Buffer.isBuffer(buffer) ? buffer.toString() : ""}`),
      contentType: "image/jpeg",
      format: "jpeg",
      quality: 80,
    }));
    resolveOgPublicImageEncodingConfigMock.mockReturnValue(imageEncodingConfigFixture);

    buildInstitutionalOgCardModelMock.mockImplementation(
      ({ pageKey, settings }: { pageKey?: string; settings?: Record<string, unknown> }) => ({
        pageKey: String(pageKey || ""),
        title: "Sobre",
        subtitle: "Conheca a fansub.",
        siteName: "Nekomata",
        sceneVersion: "institutional-og-v2",
        backgroundUrl: "/uploads/about.jpg",
        backgroundSource: "page-share-image",
        palette: {
          accentPrimary: String(settings?.theme?.accent || "#3173ff"),
          bgBase: "#02050b",
        },
        layout: {},
      }),
    );

    loadInstitutionalOgBackgroundDataUrlMock.mockImplementation(
      async ({ backgroundUrl }: { backgroundUrl?: string }) =>
        `data:background:${String(backgroundUrl || "")}`,
    );
    buildInstitutionalOgImageResponseMock.mockImplementation(
      ({ title, backgroundDataUrl }: { title?: string; backgroundDataUrl?: string }) => ({
        headers: {
          get: (name: string) => (name === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () =>
          Buffer.from(`${String(title || "")}|${String(backgroundDataUrl || "")}`),
      }),
    );
  });

  it("builds the versioned institutional path and resolves public page keys from paths", () => {
    expect(
      buildVersionedInstitutionalOgImagePath({
        pageKey: "about",
        revision: "rev-123",
      }),
    ).toBe("/api/og/institutional/about?v=rev-123");
    expect(resolveInstitutionalOgPageKeyFromPath("/projetos")).toBe("projects");
    expect(resolveInstitutionalOgPageKeyFromPath("/recrutamento")).toBe("recruitment");
  });

  it("changes the revision when share image, support text, accent or site name changes", () => {
    const original = buildInstitutionalOgRevisionValue({
      pageKey: "about",
      pages: pagesFixture,
      settings: settingsFixture,
    });
    const shareImageChanged = buildInstitutionalOgRevisionValue({
      pageKey: "about",
      pages: {
        ...pagesFixture,
        about: {
          ...pagesFixture.about,
          shareImage: "/uploads/about-v2.jpg",
        },
      },
      settings: settingsFixture,
    });
    const supportTextChanged = buildInstitutionalOgRevisionValue({
      pageKey: "about",
      pages: {
        ...pagesFixture,
        about: {
          ...pagesFixture.about,
          heroSubtitle: "Conheca melhor a equipe.",
        },
      },
      settings: settingsFixture,
    });
    const accentChanged = buildInstitutionalOgRevisionValue({
      pageKey: "about",
      pages: pagesFixture,
      settings: {
        ...settingsFixture,
        theme: {
          accent: "#ff4fa3",
        },
      },
    });
    const siteNameChanged = buildInstitutionalOgRevisionValue({
      pageKey: "about",
      pages: pagesFixture,
      settings: {
        ...settingsFixture,
        site: {
          ...settingsFixture.site,
          name: "Nekomata v2",
        },
      },
    });

    expect(shareImageChanged).not.toBe(original);
    expect(supportTextChanged).not.toBe(original);
    expect(accentChanged).not.toBe(original);
    expect(siteNameChanged).not.toBe(original);
  });

  it("returns a cache miss first, then a cache hit, with diagnostic headers", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });

    const first = await getInstitutionalOgCachedRender({
      pageKey: "about",
      pages: pagesFixture,
      settings: settingsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const firstHeaders = buildInstitutionalOgDeliveryHeaders({
      cacheHit: first?.cacheHit,
      timings: first?.timings,
    });

    const second = await getInstitutionalOgCachedRender({
      pageKey: "about",
      pages: pagesFixture,
      settings: settingsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const secondHeaders = buildInstitutionalOgDeliveryHeaders({
      cacheHit: second?.cacheHit,
      timings: second?.timings,
    });

    expect(first?.cacheHit).toBe(false);
    expect(second?.cacheHit).toBe(true);
    expect(buildInstitutionalOgImageResponseMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledTimes(1);
    expect(optimizeOgPublicImageBufferMock).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      sourceContentType: "image/png",
      targetFormat: "jpeg",
      profile: "visually-lossless",
      maxBytes: imageEncodingConfigFixture.maxBytes,
      qualityLadder: imageEncodingConfigFixture.qualityLadder,
    });
    expect(first?.contentType).toBe("image/jpeg");
    expect(first?.buffer.toString()).toContain("optimized:");
    expect(firstHeaders.cache).toBe("miss");
    expect(firstHeaders.serverTiming).toContain("cache_read;dur=");
    expect(firstHeaders.serverTiming).toContain("background_load;dur=");
    expect(firstHeaders.serverTiming).toContain("image_render;dur=");
    expect(firstHeaders.serverTiming).toContain("image_optimize;dur=");
    expect(secondHeaders.cache).toBe("hit");
    expect(secondHeaders.serverTiming).not.toContain("image_render;dur=");
  });
});
