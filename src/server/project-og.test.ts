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

const assertTransparentPng = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.width).toBe(OG_PROJECT_WIDTH);
  expect(metadata.height).toBe(OG_PROJECT_HEIGHT);
  expect(metadata.hasAlpha).toBe(true);

  const stats = await sharp(buffer).stats();
  const alpha = stats.channels[3];
  expect(alpha).toBeDefined();
  expect(alpha.min).toBe(0);
  expect(alpha.max).toBe(0);
};

describe("project og helper", () => {
  it("builds encoded project OG path", () => {
    expect(buildProjectOgImagePath("id com espaco")).toBe("/api/og/project/id%20com%20espaco");
  });

  it("builds stable card model with translations, chips and artwork source resolution", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        genres: ["drama", "misterio", "drama", "acao", "romance", "sobrenatural"],
      },
      settings: baseSettings,
      tagTranslations: { psicologico: "Psicologico" },
      genreTranslations: {
        drama: "Drama",
        misterio: "Misterio",
        acao: "Acao",
        romance: "Romance",
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
    expect(model.chips).toEqual(["Drama", "Misterio", "Acao", "Romance"]);
    expect(model.artworkSource).toBe("cover");
    expect(model.artworkUrl).toBe("/uploads/projects/oshi-no-ko/cover.jpg?preset=poster");
  });

  it("falls back to default accent palette when color is invalid", () => {
    expect(resolveProjectOgPalette("not-a-color")).toEqual(resolveProjectOgPalette("#9667e0"));
  });

  it("returns neutral stubs for static assets and fonts", () => {
    expect(loadProjectOgStaticAssetDataUrl("overlayShadow")).toBe(transparentDataUrl);
    expect(loadProjectOgStaticAssetDataUrl("anything")).toBe(transparentDataUrl);
    expect(loadProjectOgFontBuffers()).toEqual({});
    expect(buildProjectOgFonts()).toEqual([]);
  });

  it("returns transparent artwork by default and preserves incoming data urls", async () => {
    const dataUrl = "data:image/png;base64,AAA";
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: "https://example.com/image.png" })).resolves.toBe(
      transparentDataUrl,
    );
    await expect(loadProjectOgArtworkDataUrl({ artworkUrl: dataUrl })).resolves.toBe(dataUrl);
  });

  it("builds minimal transparent scenes for current and legacy render paths", () => {
    const currentScene = buildProjectOgScene({});
    const legacyScene = buildLegacyProjectOgScene({});
    const currentProps = currentScene.props as Record<string, unknown>;
    const legacyProps = legacyScene.props as Record<string, unknown>;

    expect(currentProps["data-og-layer"]).toBe("og-zero-baseline");
    expect(legacyProps["data-og-layer"]).toBe("og-zero-baseline");
    expect(currentProps.style).toEqual(
      expect.objectContaining({
        display: "flex",
        width: OG_PROJECT_WIDTH,
        height: OG_PROJECT_HEIGHT,
        backgroundColor: "rgba(0, 0, 0, 0)",
      }),
    );
  });

  it("renders a transparent PNG through ImageResponse for project OG", async () => {
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
    await assertTransparentPng(buffer);
  });

  it("renders a transparent PNG through legacy ImageResponse path", async () => {
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
    await assertTransparentPng(buffer);
  });
});
