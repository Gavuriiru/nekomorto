import { describe, expect, it } from "vitest";

import {
  computeUploadContainFitRect,
  computeUploadFocalCoverRect,
  deriveDefaultUploadFocalCropRect,
  deriveUploadFocalPointsFromCrops,
  deriveUploadViewportCoverRect,
  normalizeUploadFocalCropRect,
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
    expect(normalizeUploadFocalPoints(focalPoints).card).toEqual({ x: 0.2, y: 0.8 });
  });

  it("normaliza retangulos de crop com clamp e limites validos", () => {
    const rect = normalizeUploadFocalCropRect({
      left: 0.9,
      top: -0.1,
      width: 0.4,
      height: 2,
    });

    expect(rect).toEqual({
      left: 0.6,
      top: 0,
      width: 0.4,
      height: 1,
    });
  });

  it("deriva pontos a partir do centro geometrico do crop", () => {
    const focalPoints = deriveUploadFocalPointsFromCrops({
      card: { left: 0.1, top: 0.2, width: 0.4, height: 0.6 },
      hero: { left: 0.25, top: 0.1, width: 0.5, height: 0.2 },
    });

    expect(focalPoints.card).toEqual({ x: 0.3, y: 0.5 });
    expect(focalPoints.hero).toEqual({ x: 0.5, y: 0.2 });
  });

  it("deriva o crop legado de card usando a nova base 3:2", () => {
    const rect = deriveDefaultUploadFocalCropRect({
      preset: "card",
      sourceWidth: 1000,
      sourceHeight: 2000,
      focalPoint: { x: 0.5, y: 1 },
    });

    expect(rect).toEqual({
      left: 0,
      top: 1334 / 2000,
      width: 1,
      height: 666 / 2000,
    });
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

  it("deriva o recorte aplicado por um viewport com object-cover", () => {
    const rect = deriveUploadViewportCoverRect({
      rect: { left: 0, top: 0, width: 1, height: 1 },
      sourceWidth: 1280,
      sourceHeight: 853,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    expect(rect).toEqual({
      left: 0,
      top: 67 / 853,
      width: 1,
      height: 720 / 853,
    });
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
