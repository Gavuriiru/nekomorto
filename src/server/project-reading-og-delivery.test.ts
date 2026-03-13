import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOgRenderCache } from "../../server/lib/og-render-cache.js";

const buildProjectReadingOgCardModelMock = vi.hoisted(() => vi.fn());
const buildProjectReadingOgImageResponseMock = vi.hoisted(() => vi.fn());
const loadProjectOgArtworkDataUrlMock = vi.hoisted(() => vi.fn());
const loadProjectOgProcessedBackdropDataUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/lib/project-reading-og.js", () => ({
  PROJECT_READING_OG_SCENE_VERSION: "project-reading-og-v1",
  buildProjectReadingOgCardModel: buildProjectReadingOgCardModelMock,
  buildProjectReadingOgImagePath: ({
    projectId,
    chapterNumber,
    volume,
    revision,
  }: {
    projectId?: string;
    chapterNumber?: number;
    volume?: number;
    revision?: string;
  }) => {
    const query = new URLSearchParams();
    if (Number.isFinite(Number(volume))) {
      query.set("volume", String(volume));
    }
    if (String(revision || "").trim()) {
      query.set("v", String(revision));
    }
    const serializedQuery = query.toString();
    return `/api/og/project/${encodeURIComponent(String(projectId || "").trim())}/reading/${encodeURIComponent(String(chapterNumber || ""))}${serializedQuery ? `?${serializedQuery}` : ""}`;
  },
  buildProjectReadingOgImageResponse: buildProjectReadingOgImageResponseMock,
}));

vi.mock("../../server/lib/project-og.js", () => ({
  loadProjectOgArtworkDataUrl: loadProjectOgArtworkDataUrlMock,
  loadProjectOgProcessedBackdropDataUrl: loadProjectOgProcessedBackdropDataUrlMock,
}));

import {
  buildProjectReadingOgDeliveryHeaders,
  buildProjectReadingOgRevisionValue,
  buildVersionedProjectReadingOgImagePath,
  getProjectReadingOgCachedRender,
} from "../../server/lib/project-reading-og-delivery.js";

const projectFixture = {
  id: "projeto-teste",
  title: "Projeto Teste",
  synopsis: "Sinopse do projeto",
  cover: "/uploads/projeto/capa.jpg",
  heroImageUrl: "/uploads/projeto/hero.jpg",
  banner: "/uploads/projeto/banner.jpg",
  genres: ["drama"],
  tags: ["psicologico"],
  episodeDownloads: [
    {
      number: 1,
      volume: 2,
      title: "Capitulo 1",
      synopsis: "Sinopse do capitulo",
      content: "<p>Conteudo</p>",
      hasContent: true,
    },
  ],
};

const settingsFixture = {
  theme: {
    accent: "#3173ff",
  },
};

const translationsFixture = {
  tags: {
    psicologico: "Psicologico",
  },
  genres: {
    drama: "Drama",
  },
};

describe("project reading og delivery", () => {
  beforeEach(() => {
    buildProjectReadingOgCardModelMock.mockReset();
    buildProjectReadingOgImageResponseMock.mockReset();
    loadProjectOgArtworkDataUrlMock.mockReset();
    loadProjectOgProcessedBackdropDataUrlMock.mockReset();

    buildProjectReadingOgCardModelMock.mockImplementation(
      ({
        project,
        chapterNumber,
        volume,
        settings,
      }: {
        project?: Record<string, unknown>;
        chapterNumber?: number;
        volume?: number;
        settings?: Record<string, unknown>;
      }) => ({
        eyebrow: "Volume 2 • Capitulo 1",
        eyebrowParts: ["Volume 2", "Capitulo 1"],
        title: "Capitulo 1",
        subtitle: String(project?.title || "Projeto"),
        chapterNumberResolved: Number(chapterNumber || 1),
        volumeResolved: Number(volume || 2),
        sceneVersion: "project-reading-og-v1",
        titleFontSize: 72,
        artworkUrl: String(project?.cover || ""),
        artworkSource: "project-cover",
        backdropUrl: String(project?.banner || project?.cover || ""),
        backdropSource: "project-banner",
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
      async ({ artworkUrl }: { artworkUrl?: string }) =>
        `data:backdrop:${String(artworkUrl || "")}`,
    );
    buildProjectReadingOgImageResponseMock.mockImplementation(
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

  it("builds a versioned reading OG path and revision", () => {
    const revision = buildProjectReadingOgRevisionValue({
      project: projectFixture,
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
    });

    expect(revision).toMatch(/^[a-f0-9]{16}$/);
    expect(
      buildVersionedProjectReadingOgImagePath({
        projectId: "projeto-teste",
        chapterNumber: 1,
        volume: 2,
        revision,
      }),
    ).toBe(`/api/og/project/projeto-teste/reading/1?volume=2&v=${revision}`);
  });

  it("changes revision when artwork or backdrop selection changes, but ignores hero-only changes", () => {
    const original = buildProjectReadingOgRevisionValue({
      project: projectFixture,
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
    });
    const artworkChanged = buildProjectReadingOgRevisionValue({
      project: {
        ...projectFixture,
        episodeDownloads: [
          {
            ...projectFixture.episodeDownloads[0],
            coverImageUrl: "/uploads/projeto/capitulo-1.jpg",
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
    });
    const backdropChanged = buildProjectReadingOgRevisionValue({
      project: {
        ...projectFixture,
        banner: "/uploads/projeto/banner-v2.jpg",
      },
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
    });
    const heroOnlyChanged = buildProjectReadingOgRevisionValue({
      project: {
        ...projectFixture,
        heroImageUrl: "/uploads/projeto/hero-v2.jpg",
      },
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
    });

    expect(artworkChanged).not.toBe(original);
    expect(backdropChanged).not.toBe(original);
    expect(heroOnlyChanged).toBe(original);
  });

  it("returns a cache miss first, then a cache hit, with diagnostic headers", async () => {
    const cache = createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 });

    const first = await getProjectReadingOgCachedRender({
      project: projectFixture,
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const firstHeaders = buildProjectReadingOgDeliveryHeaders({
      cacheHit: first?.cacheHit,
      timings: first?.timings,
    });

    const second = await getProjectReadingOgCachedRender({
      project: projectFixture,
      chapterNumber: 1,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: cache,
    });
    const secondHeaders = buildProjectReadingOgDeliveryHeaders({
      cacheHit: second?.cacheHit,
      timings: second?.timings,
    });

    expect(first?.cacheHit).toBe(false);
    expect(second?.cacheHit).toBe(true);
    expect(buildProjectReadingOgImageResponseMock).toHaveBeenCalledTimes(1);
    expect(firstHeaders.cache).toBe("miss");
    expect(firstHeaders.serverTiming).toContain("cache_read;dur=");
    expect(firstHeaders.serverTiming).toContain("artwork_load;dur=");
    expect(firstHeaders.serverTiming).toContain("backdrop_process;dur=");
    expect(firstHeaders.serverTiming).toContain("image_render;dur=");
    expect(firstHeaders.serverTiming).toContain("png_optimize;dur=0");
    expect(firstHeaders.serverTiming).toContain("total;dur=");
    expect(secondHeaders.cache).toBe("hit");
    expect(secondHeaders.serverTiming).toContain("cache_read;dur=");
    expect(secondHeaders.serverTiming).toContain("total;dur=");
    expect(secondHeaders.serverTiming).not.toContain("image_render;dur=");
  });

  it("returns null when the chapter cannot be resolved", async () => {
    buildProjectReadingOgCardModelMock.mockReturnValueOnce(null);

    const rendered = await getProjectReadingOgCachedRender({
      project: projectFixture,
      chapterNumber: 999,
      volume: 2,
      settings: settingsFixture,
      translations: translationsFixture,
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
      ogRenderCache: createOgRenderCache({ ttlMs: 300_000, maxEntries: 8 }),
    });

    expect(rendered).toBeNull();
  });
});
