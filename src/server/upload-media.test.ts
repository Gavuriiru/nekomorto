import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  attachUploadMediaMetadata,
  generateUploadVariants,
  normalizeFocalPoints,
} from "../../server/lib/upload-media.js";

const tempDirs: string[] = [];

const createTempUploadsDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-media-test-"));
  tempDirs.push(dir);
  return dir;
};

const toDiskPath = (uploadsDir: string, uploadUrl: string) =>
  path.join(uploadsDir, uploadUrl.replace(/^\/uploads\//, "").replace(/\//g, path.sep));

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("upload-media focal points", () => {
  it("normaliza focos legados com fallback de og para card", () => {
    const focalPoints = normalizeFocalPoints(
      {
        og: { x: 0.2, y: 0.8 },
        hero: { x: 0.9, y: 0.1 },
      },
    );

    expect(focalPoints.card).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.hero).toEqual({ x: 0.9, y: 0.1 });
  });

  it("migra uploads legados para focalPoints e mantem focalPoint como alias", async () => {
    const result = await attachUploadMediaMetadata({
      uploadsDir: createTempUploadsDir(),
      entry: {
        id: "upload-legacy",
        folder: "posts",
        width: 100,
        height: 200,
        focalPoint: { x: 0.2, y: 0.8 },
        variants: {},
        variantsVersion: 1,
      },
      hashSha256: "abc123",
      regenerateVariants: false,
    });

    expect(result.focalPoint).toEqual({ x: 0.5, y: 0.8 });
    expect(result.focalPoints).toEqual({
      card: { x: 0.5, y: 0.8 },
      hero: { x: 0.5, y: 0.8 },
    });
    expect(result.focalCrops).toEqual({
      card: { left: 0, top: 0.66, width: 1, height: 0.28 },
      hero: { left: 0, top: 0.66, width: 1, height: 0.28 },
    });
  });

  it("gera card e og com o mesmo enquadramento logico e mantem hero independente", async () => {
    const uploadsDir = createTempUploadsDir();
    const sourcePath = path.join(uploadsDir, "source.png");

    await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 100,
              height: 100,
              channels: 4,
              background: { r: 0, g: 0, b: 255, alpha: 1 },
            },
          },
          left: 0,
          top: 100,
        },
      ])
      .png()
      .toFile(sourcePath);

    const generated = await generateUploadVariants({
      uploadsDir,
      uploadId: "upload-1",
      sourcePath,
      sourceMime: "image/png",
      focalCrops: {
        card: { left: 0, top: 0, width: 1, height: 0.28125 },
        hero: { left: 0, top: 0.71875, width: 1, height: 0.28125 },
      },
      variantsVersion: 1,
    });

    const cardPath = toDiskPath(uploadsDir, String(generated.variants.card?.formats?.fallback?.url || ""));
    const ogPath = toDiskPath(uploadsDir, String(generated.variants.og?.formats?.fallback?.url || ""));
    const heroPath = toDiskPath(uploadsDir, String(generated.variants.hero?.formats?.fallback?.url || ""));
    const cardStats = await sharp(cardPath).stats();
    const ogStats = await sharp(ogPath).stats();
    const heroStats = await sharp(heroPath).stats();

    expect(generated.variants).not.toHaveProperty("thumb");
    expect(cardStats.channels[0]?.mean ?? 0).toBeGreaterThan(cardStats.channels[2]?.mean ?? 0);
    expect(ogStats.channels[0]?.mean ?? 0).toBeGreaterThan(ogStats.channels[2]?.mean ?? 0);
    expect(heroStats.channels[2]?.mean ?? 0).toBeGreaterThan(heroStats.channels[0]?.mean ?? 0);
  });

  it("persiste focalCrops e deriva aliases de focalPoints a partir do centro", async () => {
    const result = await attachUploadMediaMetadata({
      uploadsDir: createTempUploadsDir(),
      entry: {
        id: "upload-crop",
        folder: "posts",
        width: 1600,
        height: 1600,
        variants: {},
        variantsVersion: 1,
      },
      hashSha256: "abc123",
      focalCrops: {
        card: { left: 0.1, top: 0.2, width: 0.4, height: 0.5 },
        hero: { left: 0.25, top: 0.3, width: 0.5, height: 0.4 },
      },
      regenerateVariants: false,
    });

    expect(result.focalCrops).toEqual({
      card: { left: 0.1, top: 0.2, width: 0.4, height: 0.5 },
      hero: { left: 0.25, top: 0.3, width: 0.5, height: 0.4 },
    });
    expect(result.focalPoints).toEqual({
      card: { x: 0.3, y: 0.45 },
      hero: { x: 0.5, y: 0.5 },
    });
    expect(result.focalPoint).toEqual({ x: 0.3, y: 0.45 });
  });
});
