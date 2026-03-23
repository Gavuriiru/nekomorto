import { describe, expect, it } from "vitest";

import {
  buildReaderDisplayPages,
  buildReaderSlots,
  formatVisiblePageLabel,
  interpolateContinuousPageRatio,
  pickMostVisiblePage,
  resolvePaginatedPointerAction,
} from "@/components/project-reader/project-reader-state";

describe("project-reader-state", () => {
  it("cria uma pagina de compra quando o preview limita o capitulo", () => {
    const result = buildReaderDisplayPages({
      pages: [
        { position: 0, imageUrl: "/page-1.jpg" },
        { position: 1, imageUrl: "/page-2.jpg" },
        { position: 2, imageUrl: "/page-3.jpg" },
      ],
      previewLimit: 2,
    });

    expect(result.accessiblePageCount).toBe(2);
    expect(result.hasPurchaseGate).toBe(true);
    expect(result.renderablePages).toEqual([
      { position: 0, imageUrl: "/page-1.jpg", spreadPairId: undefined, type: "page" },
      { position: 1, imageUrl: "/page-2.jpg", spreadPairId: undefined, type: "page" },
      { position: 2, type: "purchase", isPurchasePage: true },
    ]);
  });

  it("respeita spreadPairId e firstPageSingle no layout duplo", () => {
    const slots = buildReaderSlots({
      pages: [
        { position: 0, imageUrl: "/page-1.jpg", type: "page" },
        { position: 1, imageUrl: "/page-2.jpg", spreadPairId: "spread-1", type: "page" },
        { position: 2, imageUrl: "/page-3.jpg", spreadPairId: "spread-1", type: "page" },
        { position: 3, imageUrl: "/page-4.jpg", type: "page" },
      ],
      layout: "double",
      firstPageSingle: true,
    });

    expect(slots).toEqual([
      { pages: [0], spread: true, hasBlank: true },
      { pages: [1, 2], spread: true },
      { pages: [3], spread: true, hasBlank: true },
    ]);
  });

  it("formata o rotulo de pagina visivel em modos simples e duplos", () => {
    expect(
      formatVisiblePageLabel({
        layout: "single",
        activeSlotIndex: 0,
        slots: [{ pages: [0], spread: false }],
        activePageIndex: 0,
        totalPages: 4,
        accessiblePageCount: 4,
      }),
    ).toBe("1/4");

    expect(
      formatVisiblePageLabel({
        layout: "double",
        activeSlotIndex: 1,
        slots: [
          { pages: [0], spread: true, hasBlank: true },
          { pages: [1, 2], spread: true },
        ],
        activePageIndex: 1,
        totalPages: 4,
        accessiblePageCount: 4,
      }),
    ).toMatch(/2.*3 \/ 4/);
  });

  it("resolve clique/toque conforme a direcao do reader", () => {
    expect(
      resolvePaginatedPointerAction({
        layout: "single",
        direction: "rtl",
        pointerRatio: 0.25,
      }),
    ).toBe("next");

    expect(
      resolvePaginatedPointerAction({
        layout: "single",
        direction: "rtl",
        pointerRatio: 0.75,
      }),
    ).toBe("previous");

    expect(
      resolvePaginatedPointerAction({
        layout: "single",
        direction: "ltr",
        pointerRatio: 0.25,
      }),
    ).toBe("previous");
  });

  it("detecta a pagina mais visivel em layouts continuos", () => {
    expect(
      pickMostVisiblePage({
        measurements: [
          { index: 0, start: -100, end: 150 },
          { index: 1, start: 160, end: 460 },
          { index: 2, start: 470, end: 760 },
        ],
        viewportSize: 500,
      }),
    ).toBe(1);
  });

  it("mantem a pagina atual quando a candidata nao abre vantagem suficiente", () => {
    expect(
      pickMostVisiblePage({
        measurements: [
          { index: 0, start: -120, end: 360 },
          { index: 1, start: 300, end: 780 },
        ],
        viewportSize: 600,
        currentIndex: 0,
        visibilityLeadThresholdPx: 40,
      }),
    ).toBe(0);
  });

  it("troca para a candidata quando ela ultrapassa o threshold de visibilidade", () => {
    expect(
      pickMostVisiblePage({
        measurements: [
          { index: 0, start: -220, end: 180 },
          { index: 1, start: 120, end: 620 },
        ],
        viewportSize: 600,
        currentIndex: 0,
        visibilityLeadThresholdPx: 40,
      }),
    ).toBe(1);
  });

  it("interpola o ratio continuo entre paginas antes da troca de pagina ativa", () => {
    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: -100, end: 300 },
          { index: 1, start: 450, end: 850 },
        ],
        viewportSize: 640,
      }),
    ).toBeCloseTo(0.4, 4);
  });

  it("aceita uma ancora avancada para adiantar o ratio visual no sentido do scroll", () => {
    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: -100, end: 300 },
          { index: 1, start: 450, end: 850 },
        ],
        viewportSize: 640,
        viewportAnchorOffsetPx: 448,
      }),
    ).toBeCloseTo(0.6327, 4);
  });

  it("aceita uma ancora recuada para adiantar o retorno visual no sentido oposto", () => {
    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: -100, end: 300 },
          { index: 1, start: 450, end: 850 },
        ],
        viewportSize: 640,
        viewportAnchorOffsetPx: 192,
      }),
    ).toBeCloseTo(0.1673, 4);
  });

  it("mantem o centro do viewport como default quando nenhuma ancora e passada", () => {
    const measurements = [
      { index: 0, start: -100, end: 300 },
      { index: 1, start: 450, end: 850 },
    ];

    expect(
      interpolateContinuousPageRatio({
        measurements,
        viewportSize: 640,
      }),
    ).toBeCloseTo(
      interpolateContinuousPageRatio({
        measurements,
        viewportSize: 640,
        viewportAnchorOffsetPx: 320,
      }),
      6,
    );
  });

  it("faz clamp do ratio continuo no inicio e no fim do conjunto", () => {
    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: 120, end: 520 },
          { index: 1, start: 560, end: 960 },
        ],
        viewportSize: 640,
      }),
    ).toBe(0);

    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: -960, end: -560 },
          { index: 1, start: -500, end: -100 },
          { index: 2, start: -40, end: 360 },
        ],
        viewportSize: 640,
      }),
    ).toBe(1);
  });

  it("interpola corretamente com paginas de tamanhos diferentes", () => {
    expect(
      interpolateContinuousPageRatio({
        measurements: [
          { index: 0, start: -20, end: 220 },
          { index: 1, start: 260, end: 860 },
          { index: 2, start: 920, end: 1220 },
        ],
        viewportSize: 700,
      }),
    ).toBeCloseTo(0.2717, 4);
  });
});
