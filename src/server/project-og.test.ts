import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  OG_PROJECT_HEIGHT,
  OG_PROJECT_WIDTH,
  buildLegacyProjectOgImageResponse,
  buildLegacyProjectOgScene,
  buildProjectOgCardModel,
  buildProjectOgFonts,
  buildProjectOgImagePath,
  buildProjectOgImageResponse,
  buildProjectOgScene,
  loadProjectOgArtworkDataUrl,
  loadProjectOgFontBuffers,
  loadProjectOgProcessedBackdropDataUrl,
  loadProjectOgStaticAssetDataUrl,
  resolveProjectOgPalette,
} from "../../server/lib/project-og.js";

const baseSettings = {
  theme: {
    accent: "#3173ff",
  },
};

const baseProject = {
  id: "oshi-no-ko",
  title: "Oshi no Ko",
  type: "Anime",
  status: "Finalizado",
  studio: "Doga Kobo",
  genres: ["drama", "misterio"],
  tags: ["psicologico", "sobrenatural"],
  cover: "/uploads/projects/oshi-no-ko/cover.jpg",
  heroImageUrl: "/uploads/projects/oshi-no-ko/hero.jpg",
  banner: "/uploads/projects/oshi-no-ko/banner.jpg",
};

const transparentDataUrl =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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
  predicate: (candidate: { props?: Record<string, unknown> }) => boolean,
): { props?: Record<string, unknown> } | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const candidate = node as { props?: Record<string, unknown> };
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

const assertRenderedPng = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.width).toBe(OG_PROJECT_WIDTH);
  expect(metadata.height).toBe(OG_PROJECT_HEIGHT);

  const stats = await sharp(buffer).ensureAlpha().stats();
  const alpha = stats.channels[3];
  expect(alpha).toBeDefined();
  expect(alpha.max).toBeGreaterThan(0);
};

const decodeDataUrlBuffer = (value: string) => {
  const normalized = String(value || "").trim();
  const separatorIndex = normalized.indexOf(",");
  if (!normalized.startsWith("data:") || separatorIndex < 0) {
    return Buffer.alloc(0);
  }
  return Buffer.from(normalized.slice(separatorIndex + 1), "base64");
};

const parsePolygonPoints = (value: string) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",");
      return { x: Number(x), y: Number(y) };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

const resolveDiagonalXAtY = (panelPoints: string, y: number) => {
  const points = parsePolygonPoints(panelPoints);
  const topRight = points[1];
  const bottomRight = points[2];
  if (!topRight || !bottomRight || bottomRight.y === topRight.y) {
    return 0;
  }
  const progress = (y - topRight.y) / (bottomRight.y - topRight.y);
  return topRight.x + (bottomRight.x - topRight.x) * progress;
};

const resolveExpectedTitleLineMaxWidth = ({
  layout,
  fontSize,
  lineIndex,
  inset = 64,
}: {
  layout: Record<string, number | string>;
  fontSize: number;
  lineIndex: number;
  inset?: number;
}) => {
  const lineHeightPx = fontSize * 1.2;
  const centerY = Number(layout.titleTop) + lineIndex * lineHeightPx + lineHeightPx / 2;
  const diagonalX = resolveDiagonalXAtY(String(layout.panelPoints || ""), centerY);
  const rawWidth = diagonalX - Number(layout.titleLeft) - inset;
  return Math.min(
    OG_PROJECT_WIDTH - Number(layout.titleLeft),
    Math.max(Number(layout.titleWidth), rawWidth),
  );
};

describe("project og helper", () => {
  it("builds encoded project OG path", () => {
    expect(buildProjectOgImagePath("id com espaco")).toBe("/api/og/project/id%20com%20espaco");
  });

  it("builds stable card model with translations, chips and artwork source resolution", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        genres: ["drama", "misterio", "drama"],
        tags: ["psicologico", "sobrenatural", "psicologico"],
      },
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

    expect(model.width).toBe(OG_PROJECT_WIDTH);
    expect(model.height).toBe(OG_PROJECT_HEIGHT);
    expect(model.eyebrow).toBe("Anime \u2022 Finalizado");
    expect(model.eyebrowParts).toEqual(["Anime", "Finalizado"]);
    expect(model.eyebrowSeparator).toBe("\u2022");
    expect(model.title).toBe("Oshi no Ko");
    expect(model.subtitle).toBe("Doga Kobo");
    expect(model.chips).toEqual(["Drama", "Misterio", "Psicologico", "Sobrenatural"]);
    expect(model.artworkSource).toBe("cover");
    expect(model.artworkUrl).toBe("/uploads/projects/oshi-no-ko/cover.jpg?preset=poster");
    expect(model.backdropSource).toBe("banner");
    expect(model.backdropUrl).toBe("/uploads/projects/oshi-no-ko/banner.jpg?preset=hero");
    expect(model.sceneVersion).toBeTruthy();
  });

  it("falls back to default accent palette when color is invalid", () => {
    expect(resolveProjectOgPalette("not-a-color")).toEqual(resolveProjectOgPalette("#9667e0"));
  });

  it("returns neutral static assets and real Geist font buffers", () => {
    expect(loadProjectOgStaticAssetDataUrl("overlayShadow")).toBe(transparentDataUrl);
    expect(loadProjectOgStaticAssetDataUrl("anything")).toBe(transparentDataUrl);
    expect(loadProjectOgFontBuffers()).toEqual(
      expect.objectContaining({
        title: expect.any(Buffer),
        eyebrow: expect.any(Buffer),
        subtitle: expect.any(Buffer),
        chip: expect.any(Buffer),
      }),
    );
    expect(buildProjectOgFonts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Geist", weight: 700 }),
        expect.objectContaining({ name: "Geist", weight: 500 }),
        expect.objectContaining({ name: "Geist", weight: 300 }),
        expect.objectContaining({ name: "Geist", weight: 200 }),
      ]),
    );
  });

  it("returns local artwork data urls when available and can build a processed backdrop data url", async () => {
    const dataUrl = "data:image/png;base64,AAA";
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: "https://example.com/image.png" })).resolves.toBe("");
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: dataUrl })).resolves.toBe(dataUrl);

    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const processedBackdrop = await loadProjectOgProcessedBackdropDataUrl({
      artworkUrl: transparentDataUrl,
      layout: model.layout,
    });

    expect(processedBackdrop.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("clips the processed backdrop exactly to the diagonal divider", async () => {
    const inputBuffer = await sharp({
      create: {
        width: OG_PROJECT_WIDTH,
        height: OG_PROJECT_HEIGHT,
        channels: 4,
        background: { r: 255, g: 32, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const processedBackdrop = await loadProjectOgProcessedBackdropDataUrl({
      artworkUrl: `data:image/png;base64,${inputBuffer.toString("base64")}`,
      layout: model.layout,
    });
    const { data, info } = await sharp(decodeDataUrlBuffer(processedBackdrop))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sampleY = Math.floor(OG_PROJECT_HEIGHT / 2);
    const diagonalX = resolveDiagonalXAtY(model.layout.panelPoints, sampleY);
    const insideX = Math.max(0, Math.floor(diagonalX) - 8);
    const outsideX = Math.min(info.width - 1, Math.ceil(diagonalX) + 8);
    const insideAlpha = data[(sampleY * info.width + insideX) * info.channels + 3];
    const outsideAlpha = data[(sampleY * info.width + outsideX) * info.channels + 3];

    expect(insideAlpha).toBeGreaterThan(0);
    expect(outsideAlpha).toBe(0);
  });

  it("pushes the studio label down when the project name wraps", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title:
          "Um titulo de projeto longo o bastante para quebrar em multiplas linhas no card Open Graph",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.titleLines.length).toBeGreaterThan(1);
    expect(model.subtitleTop).toBe(model.layout.titleTop + model.titleHeight + model.layout.subtitleGap);
    expect(model.subtitleBottom).toBeLessThanOrEqual(model.layout.tagsTop - model.layout.subtitleLimitGap);
  });

  it("keeps the classroom title larger and without ellipsis while the studio still fits", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e 3rd",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.titleFontSize).toBeGreaterThan(model.layout.titleMinFontSize);
    expect(model.titleLines.length).toBeLessThanOrEqual(model.layout.titleMaxLines);
    expect(model.titleTruncated).toBe(false);
    expect(model.titleLineLayouts).toHaveLength(model.titleLines.length);
    expect(model.titleLineLayouts[0]?.maxWidth).toBeGreaterThan(model.layout.titleWidth);
    expect(model.titleLines.at(-1)).not.toContain("...");
    expect(model.titleLines.join(" ")).toContain("3rd");
    expect(model.subtitleBottom).toBeLessThanOrEqual(model.layout.tagsTop - model.layout.subtitleLimitGap);
  });

  it("calculates title line widths from the panel diagonal geometry", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e 3rd",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.titleLineLayouts.length).toBeGreaterThan(0);
    model.titleLineLayouts.forEach((line, index) => {
      expect(line.maxWidth).toBeCloseTo(
        resolveExpectedTitleLineMaxWidth({
          layout: model.layout as unknown as Record<string, number | string>,
          fontSize: model.titleFontSize,
          lineIndex: index,
        }),
        3,
      );
      if (index > 0) {
        expect(line.maxWidth).toBeLessThan(model.titleLineLayouts[index - 1].maxWidth);
      }
    });
  });

  it("allows four lines before truncating an oversized title", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title:
          "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e 3rd Season Extended Director Cut Deluxe Edition Ultimate Complete Broadcast Remaster Collection",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.layout.titleMaxLines).toBe(4);
    expect(model.titleLines.length).toBe(model.layout.titleMaxLines);
    expect(model.titleTruncated).toBe(true);
    expect(model.titleLines.at(-1)).toContain("...");
  });

  it("renders title and chips with nowrap styles and revised chip padding", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e",
        tags: ["psicologico", "escola", "protagonista masculino"],
      },
      settings: baseSettings,
      tagTranslations: {
        psicologico: "Psicologico",
        escola: "Escola",
        "protagonista masculino": "Protagonista masculino",
      },
      genreTranslations: { drama: "Drama", misterio: "Misterio" },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildProjectOgScene(model);
    const titleNode = findElement(
      scene,
      (candidate) =>
        candidate.props?.style &&
        (candidate.props.style as Record<string, unknown>).fontWeight === 700 &&
        (candidate.props.style as Record<string, unknown>).left === model.layout.titleLeft &&
        (candidate.props.style as Record<string, unknown>).top === model.layout.titleTop,
    );
    const tagsNode = findElement(
      scene,
      (candidate) =>
        candidate.props?.style &&
        (candidate.props.style as Record<string, unknown>).left === model.layout.tagsLeft &&
        (candidate.props.style as Record<string, unknown>).top === model.layout.tagsTop,
    );

    expect(titleNode).not.toBeNull();
    expect(titleNode?.props?.style).toEqual(
      expect.objectContaining({
        width: model.titleRenderWidth,
      }),
    );
    const titleLines = toArray(titleNode?.props?.children) as Array<{ props?: Record<string, unknown> }>;
    expect(titleLines[0]?.props?.style).toEqual(
      expect.objectContaining({
        width: model.titleLineLayouts[0]?.maxWidth,
        maxWidth: model.titleLineLayouts[0]?.maxWidth,
        whiteSpace: "nowrap",
      }),
    );

    expect(tagsNode).not.toBeNull();
    const chips = toArray(tagsNode?.props?.children) as Array<{ props?: Record<string, unknown> }>;
    expect(chips[0]?.props?.style).toEqual(
      expect.objectContaining({
        whiteSpace: "nowrap",
        paddingLeft: 14.5,
        paddingRight: 14.5,
      }),
    );
  });

  it("renders the stronger panel gradient and keeps the processed backdrop above the cover", () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const scene = buildProjectOgScene({
      ...model,
      artworkDataUrl: transparentDataUrl,
      backdropDataUrl: transparentDataUrl,
    });
    const children = toArray(scene.props?.children) as Array<{ props?: Record<string, unknown> }>;
    const artworkIndex = children.findIndex((child) => child?.props?.["data-og-part"] === "artwork");
    const backdropIndex = children.findIndex(
      (child) =>
        child?.props?.["data-og-part"] === "backdrop" &&
        child?.props?.["data-og-processed"] === "true",
    );
    const startStop = findElement(
      scene,
      (candidate) => candidate.props?.offset === "0%" && candidate.props?.stopColor === model.palette.accentDarkStart,
    );
    const endStop = findElement(
      scene,
      (candidate) =>
        candidate.props?.offset === "100%" && candidate.props?.stopColor === model.palette.accentDarkEnd,
    );

    expect(artworkIndex).toBeGreaterThanOrEqual(0);
    expect(backdropIndex).toBeGreaterThan(artworkIndex);
    expect(startStop?.props?.stopOpacity).toBe("0.86");
    expect(endStop?.props?.stopOpacity).toBe("0.90");
  });

  it("builds the current and legacy scenes with the project card layer", () => {
    const currentScene = buildProjectOgScene({});
    const legacyScene = buildLegacyProjectOgScene({});
    const currentProps = currentScene.props as Record<string, unknown>;
    const legacyProps = legacyScene.props as Record<string, unknown>;

    expect(currentProps["data-og-layer"]).toBe("project-og-card");
    expect(legacyProps["data-og-layer"]).toBe("project-og-card");
    expect(currentProps.style).toEqual(
      expect.objectContaining({
        display: "flex",
        width: OG_PROJECT_WIDTH,
        height: OG_PROJECT_HEIGHT,
        backgroundColor: "#02050b",
      }),
    );
  });

  it("renders a project PNG through ImageResponse for project OG", async () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const response = buildProjectOgImageResponse(model);
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(buffer.length).toBeGreaterThan(0);
    await assertRenderedPng(buffer);
  });

  it("renders a project PNG through legacy ImageResponse path", async () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });
    const response = buildLegacyProjectOgImageResponse(model);
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(buffer.length).toBeGreaterThan(0);
    await assertRenderedPng(buffer);
  });
});
