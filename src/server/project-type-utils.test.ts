import { describe, expect, it, vi } from "vitest";

import {
  createGetActiveProjectTypes,
  dedupeProjectTypes,
  isChapterBasedType,
  isLightNovelType,
  normalizeTypeLookupKey,
} from "../../server/lib/project-type-utils.js";

describe("project type utils", () => {
  it("normalizes type lookup keys consistently", () => {
    expect(normalizeTypeLookupKey("  Light Nóvel  ")).toBe("light novel");
    expect(normalizeTypeLookupKey("WEBTOON")).toBe("webtoon");
  });

  it("dedupes and sorts project types by normalized key", () => {
    expect(dedupeProjectTypes(["Webtoon", "manga", "MÁNGA", "Anime"])).toEqual([
      "Anime",
      "manga",
      "Webtoon",
    ]);
  });

  it("detects chapter-based and light-novel project types", () => {
    expect(isChapterBasedType("Manga")).toBe(true);
    expect(isChapterBasedType("Light Novel")).toBe(true);
    expect(isChapterBasedType("Anime")).toBe(false);
    expect(isLightNovelType("Light Novel")).toBe(true);
    expect(isLightNovelType("Webtoon")).toBe(false);
  });

  it("creates active project type resolvers with default fallback", () => {
    const loadProjects = vi.fn(() => [
      { type: " Manga ", deletedAt: null },
      { type: "Anime", deletedAt: null },
      { type: "MÁNGA", deletedAt: null },
      { type: "OVA", deletedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const normalizeProjects = vi.fn((projects) => projects);
    const getActiveProjectTypes = createGetActiveProjectTypes({
      defaultProjectTypeCatalog: ["Especial", "Anime"],
      loadProjects,
      normalizeProjects,
    });

    expect(getActiveProjectTypes()).toEqual(["Anime", "Manga"]);
    expect(loadProjects).toHaveBeenCalledTimes(1);

    const fallbackResolver = createGetActiveProjectTypes({
      defaultProjectTypeCatalog: ["Especial", "Anime"],
      loadProjects: () => [],
      normalizeProjects: (projects) => projects,
    });

    expect(fallbackResolver()).toEqual(["Anime", "Especial"]);
    expect(fallbackResolver({ includeDefaults: false })).toEqual([]);
  });
});
