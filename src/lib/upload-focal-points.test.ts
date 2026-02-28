import { describe, expect, it } from "vitest";

import {
  computeUploadFocalCoverRect,
  deriveLegacyUploadFocalPoint,
  normalizeUploadFocalPoints,
} from "@/lib/upload-focal-points";

describe("upload-focal-points", () => {
  it("normaliza mapa parcial usando fallback legado", () => {
    const focalPoints = normalizeUploadFocalPoints(
      {
        hero: { x: 0.9, y: 0.1 },
      },
      { x: 0.2, y: 0.8 },
    );

    expect(focalPoints.thumb).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.card).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.hero).toEqual({ x: 0.9, y: 0.1 });
    expect(focalPoints.og).toEqual({ x: 0.2, y: 0.8 });
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
});
