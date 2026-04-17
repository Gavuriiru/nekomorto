import { describe, expect, it } from "vitest";

import {
  getProjectReaderPreferenceByType,
  getProjectReaderPresetByType,
  normalizeProjectEpisodePages,
  normalizeProjectReaderConfig,
  normalizeProjectReaderPreferences,
  resolveProjectReaderConfig,
} from "../../shared/project-reader.js";

describe("normalizeProjectEpisodePages", () => {
  it("preserva spreadPairId valido em duas paginas adjacentes apos reindexacao", () => {
    expect(
      normalizeProjectEpisodePages([
        { position: 4, imageUrl: "/uploads/page-4.jpg" },
        {
          position: 2,
          imageUrl: "/uploads/page-2.jpg",
          spreadPairId: "spread-1",
        },
        {
          position: 1,
          imageUrl: "/uploads/page-1.jpg",
          spreadPairId: "spread-1",
        },
      ]),
    ).toEqual([
      {
        position: 0,
        imageUrl: "/uploads/page-1.jpg",
        spreadPairId: "spread-1",
      },
      {
        position: 1,
        imageUrl: "/uploads/page-2.jpg",
        spreadPairId: "spread-1",
      },
      { position: 2, imageUrl: "/uploads/page-4.jpg" },
    ]);
  });

  it("remove spreadPairId invalido quando fica orfao, repetido ou nao adjacente", () => {
    expect(
      normalizeProjectEpisodePages([
        {
          position: 0,
          imageUrl: "/uploads/page-1.jpg",
          spreadPairId: "spread-gap",
        },
        { position: 1, imageUrl: "/uploads/page-2.jpg" },
        {
          position: 2,
          imageUrl: "/uploads/page-3.jpg",
          spreadPairId: "spread-gap",
        },
        {
          position: 3,
          imageUrl: "/uploads/page-4.jpg",
          spreadPairId: "spread-many",
        },
        {
          position: 4,
          imageUrl: "/uploads/page-5.jpg",
          spreadPairId: "spread-many",
        },
        {
          position: 5,
          imageUrl: "/uploads/page-6.jpg",
          spreadPairId: "spread-many",
        },
        {
          position: 6,
          imageUrl: "/uploads/page-7.jpg",
          spreadPairId: "spread-lone",
        },
      ]),
    ).toEqual([
      { position: 0, imageUrl: "/uploads/page-1.jpg" },
      { position: 1, imageUrl: "/uploads/page-2.jpg" },
      { position: 2, imageUrl: "/uploads/page-3.jpg" },
      { position: 3, imageUrl: "/uploads/page-4.jpg" },
      { position: 4, imageUrl: "/uploads/page-5.jpg" },
      { position: 5, imageUrl: "/uploads/page-6.jpg" },
      { position: 6, imageUrl: "/uploads/page-7.jpg" },
    ]);
  });

  it("preserva width e height validos e descarta dimensoes invalidas", () => {
    expect(
      normalizeProjectEpisodePages([
        {
          position: 2,
          imageUrl: "/uploads/page-2.jpg",
          width: 1200,
          height: 1800,
        },
        {
          position: 1,
          imageUrl: "/uploads/page-1.jpg",
          width: 0,
          height: 1600,
        },
        {
          position: 0,
          imageUrl: "/uploads/page-0.jpg",
          width: 900.4,
          height: 1400.6,
        },
      ]),
    ).toEqual([
      {
        position: 0,
        imageUrl: "/uploads/page-0.jpg",
        width: 900,
        height: 1401,
      },
      { position: 1, imageUrl: "/uploads/page-1.jpg", height: 1600 },
      {
        position: 2,
        imageUrl: "/uploads/page-2.jpg",
        width: 1200,
        height: 1800,
      },
    ]);
  });
});

describe("normalizeProjectReaderConfig", () => {
  it("mantem a normalizacao base neutra entre tipos", () => {
    expect(normalizeProjectReaderConfig({}, { projectType: "manga" })).toMatchObject({
      direction: "ltr",
      layout: "single",
      imageFit: "both",
      background: "theme",
      progressStyle: "default",
      progressPosition: "bottom",
      firstPageSingle: true,
      chromeMode: "default",
      viewportMode: "viewport",
      siteHeaderVariant: "fixed",
      showSiteFooter: true,
    });

    expect(normalizeProjectReaderConfig({}, { projectType: "webtoon" })).toMatchObject({
      direction: "ltr",
      layout: "single",
      imageFit: "both",
      background: "theme",
      progressStyle: "default",
      progressPosition: "bottom",
      firstPageSingle: true,
      chromeMode: "default",
      viewportMode: "viewport",
      siteHeaderVariant: "fixed",
      showSiteFooter: true,
    });
  });

  it("expoe presets por tipo como dados de configuracao", () => {
    expect(getProjectReaderPresetByType("manga")).toMatchObject({
      direction: "rtl",
      layout: "single",
      imageFit: "both",
      chromeMode: "default",
      viewportMode: "viewport",
      siteHeaderVariant: "fixed",
      showSiteFooter: true,
    });

    expect(getProjectReaderPresetByType("webtoon")).toMatchObject({
      direction: "ltr",
      layout: "scroll-vertical",
      imageFit: "width",
      firstPageSingle: false,
      chromeMode: "cinema",
      viewportMode: "natural",
      siteHeaderVariant: "static",
      showSiteFooter: false,
    });
  });

  it("normaliza estilos legados de progresso para o contrato novo", () => {
    expect(
      normalizeProjectReaderConfig({ progressStyle: "bar" }, { projectType: "manga" }),
    ).toMatchObject({
      progressStyle: "default",
    });

    expect(
      normalizeProjectReaderConfig({ progressStyle: "glow" }, { projectType: "manga" }),
    ).toMatchObject({
      progressStyle: "default",
    });

    expect(
      normalizeProjectReaderConfig({ progressStyle: "hidden" }, { projectType: "manga" }),
    ).toMatchObject({
      progressStyle: "hidden",
    });
  });

  it("aceita campos legados e converte para o contrato novo", () => {
    expect(
      normalizeProjectReaderConfig(
        {
          viewMode: "page",
          allowSpread: true,
          showFooter: false,
          themePreset: "black",
        },
        { projectType: "manga" },
      ),
    ).toMatchObject({
      layout: "double",
      background: "black",
      progressStyle: "hidden",
    });

    expect(
      normalizeProjectReaderConfig(
        {
          viewMode: "scroll",
        },
        { projectType: "manga" },
      ),
    ).toMatchObject({
      layout: "scroll-vertical",
    });

    expect(
      normalizeProjectReaderConfig(
        {
          siteHeaderVariant: "static",
        },
        { projectType: "manga" },
      ),
    ).toMatchObject({
      siteHeaderVariant: "static",
    });

    expect(
      normalizeProjectReaderConfig(
        {
          showSiteHeader: true,
        },
        { projectType: "manga" },
      ),
    ).toMatchObject({
      siteHeaderVariant: "fixed",
    });

    expect(
      normalizeProjectReaderConfig(
        {
          showSiteHeader: false,
        },
        { projectType: "manga" },
      ),
    ).toMatchObject({
      siteHeaderVariant: "static",
    });
  });

  it("mescla preset global com overrides de projeto e capitulo", () => {
    const siteSettings = {
      reader: {
        projectTypes: {
          manga: {
            layout: "double",
            background: "white",
            siteHeaderVariant: "static",
          },
          webtoon: { layout: "scroll-horizontal" },
        },
      },
    };

    expect(
      resolveProjectReaderConfig({
        projectType: "manga",
        siteSettings,
        projectReaderConfig: { layout: "single" },
      }),
    ).toMatchObject({
      layout: "single",
      background: "white",
      siteHeaderVariant: "static",
    });

    expect(
      resolveProjectReaderConfig({
        projectType: "manga",
        siteSettings,
        siteReaderConfig: {
          layout: "scroll-horizontal",
          showSiteFooter: false,
        },
        projectReaderConfig: { layout: "single" },
      }),
    ).toMatchObject({
      layout: "scroll-horizontal",
      background: "white",
      siteHeaderVariant: "static",
      showSiteFooter: false,
    });
  });
});

describe("normalizeProjectReaderPreferences", () => {
  it("normaliza preferencias persistidas por tipo e ignora chaves fora do escopo", () => {
    const preferences = normalizeProjectReaderPreferences({
      projectTypes: {
        manga: { layout: "double", direction: "rtl" },
        webtoon: { viewMode: "scroll" },
        default: { layout: "single" },
      },
    });

    expect(getProjectReaderPreferenceByType(preferences, "manga")).toMatchObject({
      layout: "double",
      direction: "rtl",
    });
    expect(getProjectReaderPreferenceByType(preferences, "webtoon")).toMatchObject({
      layout: "scroll-vertical",
    });
    expect(getProjectReaderPreferenceByType(preferences, "light novel")).toBeNull();
  });
});
