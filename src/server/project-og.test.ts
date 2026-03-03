import { describe, expect, it } from "vitest";

import {
  buildProjectOgCardModel,
  buildProjectOgFonts,
  buildProjectOgImageResponse,
  buildProjectOgScene,
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

const artworkDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz2kAAAAASUVORK5CYII=";

const toArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
};

const collectElements = (node: unknown, bucket: Array<Record<string, unknown>> = []) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectElements(item, bucket));
    return bucket;
  }
  if (!node || typeof node !== "object") {
    return bucket;
  }
  const element = node as Record<string, unknown>;
  const props =
    element.props && typeof element.props === "object"
      ? (element.props as Record<string, unknown>)
      : null;
  if (!props) {
    return bucket;
  }
  bucket.push(element);
  collectElements(props.children, bucket);
  return bucket;
};

const findLayer = (scene: unknown, layerName: string) =>
  collectElements(scene).find(
    (element) =>
      (element.props as Record<string, unknown>)?.["data-og-layer"] === layerName,
  ) || null;

const collectDisplayViolations = (node: unknown, path = "root", issues: string[] = []) => {
  if (Array.isArray(node)) {
    node.forEach((child, index) => collectDisplayViolations(child, `${path}[${index}]`, issues));
    return issues;
  }
  if (!node || typeof node !== "object") {
    return issues;
  }
  const element = node as Record<string, unknown>;
  const type = element.type;
  const props =
    element.props && typeof element.props === "object"
      ? (element.props as Record<string, unknown>)
      : null;
  if (!props) {
    return issues;
  }
  const children = toArray(props.children).filter(
    (child) => child !== null && child !== undefined && child !== false,
  );
  const style =
    props.style && typeof props.style === "object"
      ? (props.style as Record<string, unknown>)
      : {};
  if (
    type === "div" &&
    children.length > 1 &&
    !["flex", "contents", "none"].includes(String(style.display || ""))
  ) {
    issues.push(path);
  }
  children.forEach((child, index) => {
    collectDisplayViolations(
      child,
      `${path}.${typeof type === "string" ? type : "node"}[${index}]`,
      issues,
    );
  });
  return issues;
};

describe("project og helper", () => {
  it("maps eyebrow, separator, subtitle, layout, and font families from project fields", () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: { psicologico: "Psicologico" },
      genreTranslations: { drama: "Drama", misterio: "Misterio" },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model.eyebrowParts).toEqual(["Anime", "Finalizado"]);
    expect(model.eyebrowSeparator).toBe("\u2022");
    expect(model.eyebrow).toBe("Anime \u2022 Finalizado");
    expect(model.subtitle).toBe("Doga Kobo");
    expect(model.layout).toEqual(
      expect.objectContaining({
        artworkLeft: 780,
        artworkWidth: 420,
        eyebrowLeft: 45.878,
        eyebrowTop: 62.972,
        titleLeft: 45.878,
        titleTop: 106.199,
        subtitleLeft: 45.878,
        subtitleTop: 209.329,
        dividerLeft: 776,
        dividerSkewDeg: 0,
      }),
    );
    expect(model.fontFamilies).toEqual({
      title: "Geist",
      eyebrow: "Geist Light",
      subtitle: "Geist Medium",
      chip: "Geist ExtraLight",
    });
    expect("staticAssets" in model).toBe(false);
  });

  it("prefers translated genres and limits chips to four unique items", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        genres: ["drama", "misterio", "drama", "acao", "romance", "sobrenatural"],
        tags: ["fantasia"],
      },
      settings: baseSettings,
      tagTranslations: { fantasia: "Fantasia" },
      genreTranslations: {
        drama: "Drama",
        misterio: "Misterio",
        acao: "Acao",
        romance: "Romance",
        sobrenatural: "Sobrenatural",
      },
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.chips).toEqual(["Drama", "Misterio", "Acao", "Romance"]);
  });

  it("falls back to translated tags when genres are absent", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        genres: [],
        tags: ["psicologico", "sobrenatural"],
      },
      settings: baseSettings,
      tagTranslations: {
        psicologico: "Psicologico",
        sobrenatural: "Sobrenatural",
      },
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.chips).toEqual(["Psicologico", "Sobrenatural"]);
  });

  it("selects artwork in cover -> hero -> banner order and exposes the winning source", () => {
    const coverModel = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const heroModel = buildProjectOgCardModel({
      project: {
        ...baseProject,
        cover: "",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const bannerModel = buildProjectOgCardModel({
      project: {
        ...baseProject,
        cover: "",
        heroImageUrl: "",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(coverModel.artworkSource).toBe("cover");
    expect(coverModel.artworkUrl).toBe("/uploads/projects/oshi-no-ko/cover.jpg?preset=poster");
    expect(heroModel.artworkSource).toBe("heroImageUrl");
    expect(heroModel.artworkUrl).toBe("/uploads/projects/oshi-no-ko/hero.jpg?preset=hero");
    expect(bannerModel.artworkSource).toBe("banner");
    expect(bannerModel.artworkUrl).toBe("/uploads/projects/oshi-no-ko/banner.jpg?preset=hero");
  });

  it("falls back to the default accent when the configured accent is invalid", () => {
    expect(resolveProjectOgPalette("not-a-color")).toEqual(
      resolveProjectOgPalette("#9667e0"),
    );
  });

  it("truncates long title and subtitle values for the card model", () => {
    const model = buildProjectOgCardModel({
      project: {
        ...baseProject,
        title:
          "Um titulo extremamente longo para validar o truncamento do card open graph",
        studio: "Um nome de estudio extraordinariamente grande para a linha azul",
      },
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.title.endsWith("...")).toBe(true);
    expect(model.title.length).toBeLessThanOrEqual(46);
    expect(model.subtitle.endsWith("...")).toBe(true);
    expect(model.subtitle.length).toBeLessThanOrEqual(38);
  });

  it("loads the Geist fonts", () => {
    const fonts = buildProjectOgFonts();

    expect(fonts).toHaveLength(4);
    expect(fonts.map((font) => font.name)).toEqual([
      "Geist",
      "Geist Light",
      "Geist Medium",
      "Geist ExtraLight",
    ]);
    expect(fonts.map((font) => font.weight)).toEqual([700, 300, 500, 200]);
    expect(fonts.every((font) => Buffer.byteLength(Buffer.from(font.data)) > 1000)).toBe(true);
  });

  it("builds the simplified css-only layered scene with the expected coordinates", () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const scene = buildProjectOgScene(model);
    const sceneWithArtwork = buildProjectOgScene({
      ...model,
      artworkDataUrl,
    });
    const requiredLayers = [
      "bg-base",
      "bg-gradient-main",
      "bg-gradient-soft",
      "artwork-image",
      "divider-line",
      "content",
      "eyebrow-row",
      "headline-stack",
      "title-text",
      "subtitle-text",
    ];

    requiredLayers.forEach((layerName) => {
      expect(findLayer(scene, layerName)).not.toBeNull();
    });

    const artwork = findLayer(sceneWithArtwork, "artwork-image");
    const bgMain = findLayer(scene, "bg-gradient-main");
    const bgSoft = findLayer(scene, "bg-gradient-soft");
    const dividerLine = findLayer(scene, "divider-line");
    const headlineStack = findLayer(scene, "headline-stack");
    const titleText = findLayer(scene, "title-text");
    const subtitleText = findLayer(scene, "subtitle-text");
    const artworkInner = toArray((artwork?.props as Record<string, unknown>)?.children)[0] as
      | Record<string, unknown>
      | undefined;
    const titleInner = toArray((titleText?.props as Record<string, unknown>)?.children)[0] as
      | Record<string, unknown>
      | undefined;
    const subtitleInner = toArray((subtitleText?.props as Record<string, unknown>)?.children)[0] as
      | Record<string, unknown>
      | undefined;

    expect((artwork?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        left: 780,
        width: 420,
        height: 630,
      }),
    );
    expect((artworkInner?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        left: -18,
        top: -12,
        width: 456,
        height: 654,
        objectFit: "cover",
      }),
    );
    const imageNodes = collectElements(sceneWithArtwork).filter((element) => element.type === "img");
    expect(imageNodes).toHaveLength(1);
    expect((bgMain?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        width: 780,
        backgroundImage: expect.stringContaining("linear-gradient"),
      }),
    );
    expect((bgSoft?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        width: 780,
        backgroundImage: expect.stringContaining("radial-gradient"),
      }),
    );
    expect((dividerLine?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        left: 776,
        width: 8,
        background: model.palette.accentLine,
      }),
    );
    expect(
      ((dividerLine?.props as Record<string, unknown>)?.style as Record<string, unknown> | undefined)
        ?.transform,
    ).toBeUndefined();
    expect((headlineStack?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        left: 45.878,
        top: 106.199,
        display: "flex",
        flexDirection: "column",
      }),
    );
    expect((titleText?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        display: "flex",
        maxHeight: expect.any(Number),
        overflow: "hidden",
      }),
    );
    expect((titleInner?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        fontFamily: "Geist",
      }),
    );
    expect((subtitleText?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        display: "flex",
        marginTop: 14,
        width: 420,
      }),
    );
    expect(
      ((subtitleText?.props as Record<string, unknown>)?.style as Record<string, unknown> | undefined)
        ?.top,
    ).toBeUndefined();
    expect((subtitleInner?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        fontFamily: "Geist Medium",
      }),
    );
    expect(findLayer(scene, "chips-row")).toBeNull();
    expect(findLayer(scene, "bg-beam")).toBeNull();
    expect(findLayer(scene, "divider-shadow")).toBeNull();
    expect(findLayer(scene, "noise-x")).toBeNull();
    expect(findLayer(scene, "noise-y")).toBeNull();
    expect(collectElements(sceneWithArtwork).filter((element) => element.type === "img")).toHaveLength(1);

    const rootChildren = toArray((scene as Record<string, unknown>).props?.children).filter(Boolean);
    const orderedLayers = rootChildren.map(
      (child) => ((child as Record<string, unknown>).props as Record<string, unknown>)?.["data-og-layer"],
    );
    expect(orderedLayers).toEqual([
      "bg-base",
      "bg-gradient-main",
      "bg-gradient-soft",
      "artwork-image",
      "divider-line",
      "content",
    ]);
  });

  it("keeps the simplified css-only accent layers tied to the resolved palette", () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const scene = buildProjectOgScene(model);
    const bgMain = findLayer(scene, "bg-gradient-main");
    const bgSoft = findLayer(scene, "bg-gradient-soft");
    const dividerLine = findLayer(scene, "divider-line");

    expect((bgMain?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        backgroundImage: expect.stringContaining(model.palette.accentDarkStart),
      }),
    );
    expect((bgSoft?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        backgroundImage: expect.stringContaining("radial-gradient"),
      }),
    );
    expect((dividerLine?.props as Record<string, unknown>)?.style).toEqual(
      expect.objectContaining({
        background: model.palette.accentLine,
      }),
    );
    expect(
      ((dividerLine?.props as Record<string, unknown>)?.style as Record<string, unknown> | undefined)
        ?.transform,
    ).toBeUndefined();
  });

  it("keeps every multi-child div compatible with Satori display rules", () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const scene = buildProjectOgScene(model);

    expect(collectDisplayViolations(scene)).toEqual([]);
  });

  it("renders a PNG through ImageResponse without throwing", async () => {
    const model = buildProjectOgCardModel({
      project: baseProject,
      settings: baseSettings,
      tagTranslations: {},
      genreTranslations: {},
      origin: "https://nekomata.moe",
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });
    const response = buildProjectOgImageResponse({
      ...model,
      artworkDataUrl,
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(buffer.length).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toContain("image/png");
  });
});
