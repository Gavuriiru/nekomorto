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

const assertRenderedPng = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.width).toBe(OG_PROJECT_WIDTH);
  expect(metadata.height).toBe(OG_PROJECT_HEIGHT);

  const stats = await sharp(buffer).ensureAlpha().stats();
  const alpha = stats.channels[3];
  expect(alpha).toBeDefined();
  expect(alpha.max).toBeGreaterThan(0);
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

  it("returns local artwork data urls when available and preserves incoming data urls", async () => {
    const dataUrl = "data:image/png;base64,AAA";
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: "https://example.com/image.png" })).resolves.toBe("");
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: dataUrl })).resolves.toBe(dataUrl);
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
    expect(model.subtitleTop).toBeGreaterThan(model.layout.subtitleBaseTop);
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
