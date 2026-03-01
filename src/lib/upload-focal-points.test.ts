import { describe, expect, it } from "vitest";

import {
  computeUploadContainFitRect,
  computeUploadFocalCoverRect,
  deriveLegacyUploadFocalPoint,
  normalizeUploadFocalPoints,
} from "@/lib/upload-focal-points";

describe("upload-focal-points", () => {
  it("normaliza mapa parcial usando fallbacks legados por preset", () => {
    const focalPoints = normalizeUploadFocalPoints(
      {
        og: { x: 0.2, y: 0.8 },
        hero: { x: 0.9, y: 0.1 },
      },
    );

    expect(focalPoints.card).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.hero).toEqual({ x: 0.9, y: 0.1 });
    expect(deriveLegacyUploadFocalPoint(focalPoints)).toEqual({ x: 0.2, y: 0.8 });
  });

  it("calcula o retangulo de crop respeitando a proporcao alvo", () => {
    const rect = computeUploadFocalCoverRect({
      sourceWidth: 1000,
      sourceHeight: 2000,
      targetWidth: 1600,
      targetHeight: 900,
      focalPoint: { x: 0.5, y: 1 },
    });

    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(563);
    expect(rect.left).toBe(0);
    expect(rect.top).toBe(1437);
  });

  it("calcula o retangulo de contain para exibir a imagem inteira", () => {
    const rect = computeUploadContainFitRect({
      stageWidth: 800,
      stageHeight: 320,
      sourceWidth: 1000,
      sourceHeight: 2000,
    });

    expect(rect.width).toBe(160);
    expect(rect.height).toBe(320);
    expect(rect.left).toBe(320);
    expect(rect.top).toBe(0);
    expect(rect.scale).toBeCloseTo(0.16);
  });
});
