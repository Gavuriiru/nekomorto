import { describe, expect, it } from "vitest";

import { buildMangaSpreadSlots } from "@/components/project-reader/manga-spread-slots";

describe("buildMangaSpreadSlots", () => {
  it("mantem o comportamento automatico para paginas sem marcacao", () => {
    expect(
      buildMangaSpreadSlots({
        pages: [{}, {}, {}],
        spreadMode: true,
        firstPageSingle: true,
      }),
    ).toEqual([
      { pages: [0], spread: true, hasBlank: true },
      { pages: [1, 2], spread: true },
    ]);
  });

  it("mantem um par marcado junto e insere blank virtual quando a paridade conflita", () => {
    expect(
      buildMangaSpreadSlots({
        pages: [{}, { spreadPairId: "spread-1" }, { spreadPairId: "spread-1" }, {}],
        spreadMode: true,
        firstPageSingle: false,
      }),
    ).toEqual([
      { pages: [0], spread: true, hasBlank: true },
      { pages: [1, 2], spread: true },
      { pages: [3], spread: false },
    ]);
  });

  it("nao quebra um spread forçado no inicio quando firstPageSingle esta ativo", () => {
    expect(
      buildMangaSpreadSlots({
        pages: [{ spreadPairId: "spread-1" }, { spreadPairId: "spread-1" }, {}],
        spreadMode: true,
        firstPageSingle: true,
      }),
    ).toEqual([
      { pages: [0, 1], spread: true },
      { pages: [2], spread: false },
    ]);
  });

  it("ignora spreads forçados quando o modo spread esta desativado", () => {
    expect(
      buildMangaSpreadSlots({
        pages: [{ spreadPairId: "spread-1" }, { spreadPairId: "spread-1" }],
        spreadMode: false,
        firstPageSingle: true,
      }),
    ).toEqual([
      { pages: [0], spread: false },
      { pages: [1], spread: false },
    ]);
  });
});
