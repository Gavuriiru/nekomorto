import { describe, expect, it } from "vitest";

import {
  getProjectReaderPreferenceByType,
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
        { position: 2, imageUrl: "/uploads/page-2.jpg", spreadPairId: "spread-1" },
        { position: 1, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-1" },
      ]),
    ).toEqual([
      { position: 0, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-1" },
      { position: 1, imageUrl: "/uploads/page-2.jpg", spreadPairId: "spread-1" },
      { position: 2, imageUrl: "/uploads/page-4.jpg" },
    ]);
  });

  it("remove spreadPairId invalido quando fica orfao, repetido ou nao adjacente", () => {
    expect(
      normalizeProjectEpisodePages([
        { position: 0, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-gap" },
        { position: 1, imageUrl: "/uploads/page-2.jpg" },
        { position: 2, imageUrl: "/uploads/page-3.jpg", spreadPairId: "spread-gap" },
        { position: 3, imageUrl: "/uploads/page-4.jpg", spreadPairId: "spread-many" },
        { position: 4, imageUrl: "/uploads/page-5.jpg", spreadPairId: "spread-many" },
        { position: 5, imageUrl: "/uploads/page-6.jpg", spreadPairId: "spread-many" },
        { position: 6, imageUrl: "/uploads/page-7.jpg", spreadPairId: "spread-lone" },
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
});

describe("normalizeProjectReaderConfig", () => {
  it("aplica os novos defaults por tipo", () => {
    expect(normalizeProjectReaderConfig({}, { projectType: "manga" })).toMatchObject({
      direction: "rtl",
      layout: "single",
      imageFit: "both",
      background: "theme",
      progressStyle: "bar",
      progressPosition: "bottom",
      firstPageSingle: true,
    });

    expect(normalizeProjectReaderConfig({}, { projectType: "webtoon" })).toMatchObject({
      direction: "ltr",
      layout: "scroll-vertical",
      imageFit: "width",
      background: "theme",
      progressStyle: "bar",
      progressPosition: "bottom",
      firstPageSingle: false,
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
  });

  it("mantem a precedencia entre resposta publica, preset global e defaults", () => {
    const siteSettings = {
      reader: {
        projectTypes: {
          manga: { layout: "double", background: "white" },
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
      layout: "double",
      background: "white",
    });

    expect(
      resolveProjectReaderConfig({
        projectType: "manga",
        siteSettings,
        siteReaderConfig: { layout: "scroll-horizontal" },
        projectReaderConfig: { layout: "double" },
      }),
    ).toMatchObject({
      layout: "scroll-horizontal",
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
      direction: "ltr",
    });
    expect(getProjectReaderPreferenceByType(preferences, "light novel")).toBeNull();
  });
});
