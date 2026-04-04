import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildProjectReadingOgCardModel,
  buildProjectReadingOgImagePath,
  buildProjectReadingOgImageResponse,
  buildProjectReadingOgScene,
} from "../../server/lib/project-reading-og.js";
import { getDiagonalXAtY } from "../../server/lib/project-og.js";

const baseSettings = {
  theme: {
    accent: "#3173ff",
  },
};

const baseProject = {
  id: "projeto-teste",
  title: "Projeto Teste",
  synopsis: "Sinopse do projeto",
  description: "Descricao do projeto",
  type: "Light Novel",
  status: "Em andamento",
  genres: ["drama", "misterio"],
  tags: ["psicologico", "sobrenatural"],
  cover: "/uploads/projects/projeto-teste/cover.jpg",
  heroImageUrl: "/uploads/projects/projeto-teste/hero.jpg",
  banner: "/uploads/projects/projeto-teste/banner.jpg",
  volumeEntries: [
    {
      volume: 2,
      synopsis: "Sinopse do volume 2",
      coverImageUrl: "/uploads/projects/projeto-teste/volume-2.jpg",
      coverImageAlt: "Volume 2",
    },
  ],
  volumeCovers: [
    {
      volume: 2,
      coverImageUrl: "/uploads/projects/projeto-teste/volume-2-alt.jpg",
      coverImageAlt: "Volume 2 alt",
    },
  ],
  episodeDownloads: [
    {
      number: 1,
      volume: 2,
      title: "Titulo do capitulo",
      synopsis: "Sinopse do capitulo",
      coverImageUrl: "/uploads/projects/projeto-teste/chapter-1.jpg",
      coverImageAlt: "Capitulo 1",
      content: "<p>Conteudo</p>",
      hasContent: true,
      readingOrder: 1,
    },
  ],
};

type TestElementProps = Record<string, unknown> & {
  children?: unknown;
  style?: Record<string, unknown>;
};

type TestElement = {
  props?: TestElementProps;
};

const toArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
};

const findElement = (
  node: unknown,
  predicate: (candidate: TestElement) => boolean,
): TestElement | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const candidate = node as TestElement;
  if (predicate(candidate)) {
    return candidate;
  }
  const children = toArray(candidate.props?.children);
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
};

const getSubtitleLineMargin = (
  model: Record<string, unknown> | null | undefined,
  lineIndex: number,
) => {
  const layout = (model?.layout as Record<string, unknown> | undefined) || {};
  const subtitleTop = Number(model?.subtitleTop || 0);
  const subtitleFontSize = Number(layout.subtitleFontSize || 0);
  const subtitleLineHeight = subtitleFontSize * 1.2;
  const centerY = subtitleTop + lineIndex * subtitleLineHeight + subtitleLineHeight / 2;
  const diagonalX = getDiagonalXAtY({
    layout: model?.layout,
    y: centerY,
  });
  const subtitleLineLayouts = Array.isArray(model?.subtitleLineLayouts)
    ? model.subtitleLineLayouts
    : [];
  const lineLayout = subtitleLineLayouts[lineIndex] as Record<string, unknown> | undefined;
  return diagonalX - Number(layout.subtitleLeft || 0) - Number(lineLayout?.maxWidth || 0);
};

describe("project reading og", () => {
  it("builds a reading OG path with optional volume and revision", () => {
    expect(
      buildProjectReadingOgImagePath({
        projectId: "projeto-teste",
        chapterNumber: 1,
        volume: 2,
        revision: "rev-123",
      }),
    ).toBe("/api/og/project/projeto-teste/reading/1?volume=2&v=rev-123");
  });

  it("maps chapter, project title and reading image hierarchy into the OG card model", () => {
    const model = buildProjectReadingOgCardModel({
      project: baseProject,
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {
        psicologico: "Psicologico",
        sobrenatural: "Sobrenatural",
      },
      genreTranslations: {
        drama: "Drama",
        misterio: "Misterio",
      },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model).toBeTruthy();
    expect(model?.eyebrowParts?.[0]).toBe("Volume 2");
    expect(String(model?.eyebrowParts?.[1] || "")).toContain("1");
    expect(model?.title).toBe("Titulo do capitulo");
    expect(model?.subtitle).toBe("Projeto Teste");
    expect(model?.subtitleLines).toEqual(["Projeto Teste"]);
    expect(model?.chips).toEqual(["Drama", "Misterio", "Psicologico", "Sobrenatural"]);
    expect(model?.artworkSource).toBe("chapter-cover");
    expect(model?.backdropSource).toBe("project-banner");
    expect(model?.artworkUrl).toBe("/uploads/projects/projeto-teste/chapter-1.jpg?preset=poster");
    expect(model?.backdropUrl).toBe("/uploads/projects/projeto-teste/banner.jpg?preset=hero");
  });

  it("wraps a long project subtitle into two diagonal-safe lines before using ellipsis", () => {
    const projectTitle = "Watashi, Nouryoku wa Heikinchi de Itta yo ne! Next Life Chronicle";
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        title: projectTitle,
        episodeDownloads: [
          {
            number: 68,
            volume: 9,
            title: "Chapter 68: Stronger Monsters",
            synopsis: "Sinopse do capitulo",
            coverImageUrl: "/uploads/projects/projeto-teste/chapter-68.jpg",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 68,
      volume: 9,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildProjectReadingOgScene(model);
    const subtitleContainer = findElement(
      scene,
      (candidate) =>
        candidate.props?.style?.flexDirection === "column" &&
        candidate.props?.style?.left === model?.layout?.subtitleLeft &&
        candidate.props?.style?.top === model?.subtitleTop,
    );

    expect(model?.subtitleLines).toHaveLength(2);
    expect(model?.subtitleLines).toEqual([
      "Watashi, Nouryoku wa Heikinchi de Itta yo ne!",
      "Next Life Chronicle",
    ]);
    expect(model?.subtitleTruncated).toBe(false);
    expect(Number(model?.subtitleLineLayouts?.[0]?.maxWidth || 0)).toBeGreaterThan(360);
    expect(Number(model?.subtitleLineLayouts?.[1]?.maxWidth || 0)).toBeLessThan(
      Number(model?.subtitleLineLayouts?.[0]?.maxWidth || 0),
    );
    expect(getSubtitleLineMargin(model, 0)).toBeCloseTo(48, 3);
    expect(getSubtitleLineMargin(model, 1)).toBeCloseTo(48, 3);
    expect(Number(model?.subtitleBottom || 0)).toBeLessThanOrEqual(
      Number(model?.layout?.tagsTop || 0) - Number(model?.layout?.subtitleLimitGap || 0),
    );
    expect(subtitleContainer).not.toBeNull();
  });

  it("applies ellipsis only on the last subtitle line when two diagonal-safe lines still are not enough", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        title:
          "Kimi to Boku no Saigo no Senjou, Aruiwa Sekai ga Hajimaru Seisen Season Final Edition Chronicle",
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title:
              "A chapter title that is intentionally very tall so the subtitle has less horizontal space",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model?.subtitleLines).toHaveLength(2);
    expect(String(model?.subtitleLines?.[0] || "")).not.toContain("...");
    expect(String(model?.subtitleLines?.[1] || "")).toContain("...");
    expect(String(model?.subtitleLines?.[1] || "")).not.toContain("Edition C...");
    expect(model?.subtitleTruncated).toBe(true);
    expect(getSubtitleLineMargin(model, 0)).toBeCloseTo(48, 3);
    expect(getSubtitleLineMargin(model, 1)).toBeCloseTo(48, 3);
    expect(Number(model?.subtitleBottom || 0)).toBeLessThanOrEqual(
      Number(model?.layout?.tagsTop || 0) - Number(model?.layout?.subtitleLimitGap || 0),
    );
  });

  it("omits the volume label when the chapter does not belong to a volume", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        episodeDownloads: [
          {
            number: 7,
            title: "Capitulo sem volume",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 7,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model?.eyebrowParts).toHaveLength(1);
    expect(String(model?.eyebrowParts?.[0] || "")).toContain("7");
    expect(model?.title).toBe("Capitulo sem volume");
  });

  it("uses the volume query to disambiguate repeated chapter numbers", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        volumeEntries: [
          {
            volume: 3,
            synopsis: "Sinopse do volume 3",
            coverImageUrl: "/uploads/projects/projeto-teste/volume-3.jpg",
            coverImageAlt: "Volume 3",
          },
        ],
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Capitulo 1 - Volume 2",
            synopsis: "Sinopse do capitulo",
            coverImageUrl: "/uploads/projects/projeto-teste/chapter-1-v2.jpg",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
          {
            number: 1,
            volume: 3,
            title: "Capitulo 1 - Volume 3",
            synopsis: "Sinopse do capitulo 3",
            coverImageUrl: "/uploads/projects/projeto-teste/chapter-1-v3.jpg",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 3,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model?.eyebrowParts?.[0]).toBe("Volume 3");
    expect(String(model?.eyebrowParts?.[1] || "")).toContain("1");
    expect(model?.title).toBe("Capitulo 1 - Volume 3");
    expect(model?.artworkUrl).toBe("/uploads/projects/projeto-teste/chapter-1-v3.jpg");
  });

  it("falls back to the project cover and then to a dark artwork shell when no chapter image exists", () => {
    const modelWithVolumeCover = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        banner: "",
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Titulo do capitulo",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(modelWithVolumeCover?.artworkSource).toBe("volume-entry-cover");
    expect(modelWithVolumeCover?.backdropSource).toBe("volume-entry-cover");
    expect(modelWithVolumeCover?.artworkUrl).toBe(
      "/uploads/projects/projeto-teste/volume-2.jpg?preset=poster",
    );
    expect(modelWithVolumeCover?.backdropUrl).toBe(
      "/uploads/projects/projeto-teste/volume-2.jpg?preset=hero",
    );

    const modelWithProjectCover = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        banner: "",
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Titulo do capitulo",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
        volumeEntries: [],
        volumeCovers: [],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(modelWithProjectCover?.artworkSource).toBe("project-cover");
    expect(modelWithProjectCover?.backdropSource).toBe("project-cover");

    const noImageModel = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        cover: "",
        heroImageUrl: "",
        banner: "",
        volumeEntries: [],
        volumeCovers: [],
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Titulo do capitulo",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildProjectReadingOgScene(noImageModel);
    const artworkFallback = findElement(
      scene,
      (candidate) => candidate.props?.["data-og-part"] === "artwork-fallback",
    );

    expect(noImageModel?.artworkUrl).toBe("");
    expect(noImageModel?.backdropUrl).toBe("");
    expect(artworkFallback).not.toBeNull();
  });

  it("prefers the volume cover over auto-derived page art for image chapters", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        type: "Manga",
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Capitulo em paginas",
            synopsis: "Sinopse do capitulo",
            content: "",
            contentFormat: "images",
            hasPages: true,
            coverImageUrl: "/uploads/projects/projeto-teste/chapter-1-page-1.jpg",
            pages: [
              {
                position: 0,
                imageUrl: "/uploads/projects/projeto-teste/chapter-1-page-1.jpg",
              },
            ],
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model?.artworkSource).toBe("volume-entry-cover");
    expect(model?.artworkUrl).toBe("/uploads/projects/projeto-teste/volume-2.jpg?preset=poster");
  });

  it("keeps the first chapter page as artwork fallback when no volume cover exists", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        type: "Manga",
        volumeEntries: [],
        volumeCovers: [],
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Capitulo em paginas",
            synopsis: "Sinopse do capitulo",
            content: "",
            contentFormat: "images",
            hasPages: true,
            coverImageUrl: "/uploads/projects/projeto-teste/chapter-1-page-1.jpg",
            pages: [
              {
                position: 0,
                imageUrl: "/uploads/projects/projeto-teste/chapter-1-page-1.jpg",
              },
            ],
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model?.artworkSource).toBe("chapter-page");
    expect(model?.artworkUrl).toBe(
      "/uploads/projects/projeto-teste/chapter-1-page-1.jpg?preset=hero",
    );
  });

  it("ignores project hero images in the reading OG fallbacks", () => {
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        cover: "",
        banner: "",
        volumeEntries: [],
        volumeCovers: [],
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Titulo do capitulo",
            synopsis: "Sinopse do capitulo",
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model?.artworkUrl).toBe("");
    expect(model?.backdropUrl).toBe("");
    expect(model?.artworkSource).toBe("none");
    expect(model?.backdropSource).toBe("none");
  });

  it("renders a reading OG PNG in the expected 1200x630 canvas", async () => {
    const transparentDataUrl =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    const model = buildProjectReadingOgCardModel({
      project: {
        ...baseProject,
        cover: transparentDataUrl,
        heroImageUrl: transparentDataUrl,
        banner: transparentDataUrl,
        volumeEntries: [],
        volumeCovers: [],
        episodeDownloads: [
          {
            number: 1,
            volume: 2,
            title: "Titulo do capitulo",
            synopsis: "Sinopse do capitulo",
            coverImageUrl: transparentDataUrl,
            content: "<p>Conteudo</p>",
            hasContent: true,
          },
        ],
      },
      chapterNumber: 1,
      volume: 2,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const response = buildProjectReadingOgImageResponse(model);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
  });
});
