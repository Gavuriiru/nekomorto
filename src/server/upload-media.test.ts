import fs from "fs";
import os from "os";
import path from "path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { buildStorageAreaSummary, generateUploadVariants } from "../../server/lib/upload-media.js";

const tempDirs: string[] = [];

const createTempUploadsDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nekomorto-upload-media-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("upload-media", () => {
  it("gera apenas avif e evita upscale em imagens pequenas", async () => {
    const uploadsDir = createTempUploadsDir();
    const sourcePath = path.join(uploadsDir, "source.png");

    await sharp({
      create: {
        width: 230,
        height: 326,
        channels: 3,
        background: { r: 220, g: 140, b: 90 },
      },
    })
      .png()
      .toFile(sourcePath);

    const generated = await generateUploadVariants({
      uploadsDir,
      uploadId: "upload-1",
      sourcePath,
      sourceMime: "image/png",
      variantsVersion: 1,
    });

    const variantDir = path.join(uploadsDir, "_variants", "upload-1");
    const files = fs.readdirSync(variantDir);

    expect(files).toHaveLength(6);
    expect(files.every((file) => file.endsWith(".avif"))).toBe(true);
    expect(generated.variantBytes).toBeGreaterThan(0);
    expect(generated.variantBytes).toBe(
      Object.values(generated.variants).reduce((sum, variant) => {
        const size = Number(variant?.formats?.avif?.size || 0);
        return sum + size;
      }, 0),
    );

    for (const preset of Object.values(generated.variants)) {
      expect(preset?.formats?.avif?.url || "").toContain(".avif");
      expect(preset?.formats?.webp).toBeUndefined();
      expect(preset?.formats?.fallback).toBeUndefined();
    }

    const cardMetadata = await sharp(path.join(variantDir, "card-v1.avif")).metadata();
    expect(Number(cardMetadata.width || 0)).toBeLessThanOrEqual(230);
    expect(Number(cardMetadata.height || 0)).toBeLessThanOrEqual(326);
  });

  it("resume uploads com variantes esparsas e legadas sem perder contagem", () => {
    const summary = buildStorageAreaSummary([
      {
        area: "posts",
        size: 100,
        variants: {
          card: {
            formats: {
              avif: { size: 30 },
            },
          },
        },
      },
      {
        area: "posts",
        size: 50,
        variants: {
          hero: {
            formats: {
              avif: { size: 20 },
              webp: { size: 25 },
              fallback: { size: 35 },
            },
          },
        },
      },
    ]);

    expect(summary.totals.originalBytes).toBe(150);
    expect(summary.totals.variantBytes).toBe(110);
    expect(summary.totals.variantFiles).toBe(4);
    expect(summary.areas).toEqual([
      {
        area: "posts",
        originalBytes: 150,
        variantBytes: 110,
        totalBytes: 260,
        originalFiles: 2,
        variantFiles: 4,
        totalFiles: 6,
      },
    ]);
  });
});
