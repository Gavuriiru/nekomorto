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

const createPatternSourceImage = async (sourcePath: string) => {
  const width = 1280;
  const height = 1800;
  const channels = 3;
  const buffer = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      buffer[index] = (x * 17 + y * 11) % 256;
      buffer[index + 1] = (x * 7 + y * 19 + ((x ^ y) % 97)) % 256;
      buffer[index + 2] = (x * 13 + y * 5 + ((x * y) % 251)) % 256;
    }
  }

  await sharp(buffer, { raw: { width, height, channels } }).png().toFile(sourcePath);
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

    expect(files).toHaveLength(14);
    expect(files).toEqual(
      expect.arrayContaining([
        "card-v1.avif",
        "cardHomeXs-v1.avif",
        "cardHomeSm-v1.avif",
        "cardHome-v1.avif",
        "cardWide-v1.avif",
        "heroXs-v1.avif",
        "heroSm-v1.avif",
        "heroMd-v1.avif",
        "hero-v1.avif",
        "og-v1.avif",
        "poster-v1.avif",
        "posterThumbSm-v1.avif",
        "posterThumb-v1.avif",
        "square-v1.avif",
      ]),
    );
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

  it("mantem posterThumbSm e posterThumb abaixo dos tetos esperados", async () => {
    const uploadsDir = createTempUploadsDir();
    const sourcePath = path.join(uploadsDir, "pattern-source.png");

    await createPatternSourceImage(sourcePath);

    const generated = await generateUploadVariants({
      uploadsDir,
      uploadId: "upload-pattern",
      sourcePath,
      sourceMime: "image/png",
      variantsVersion: 1,
    });

    expect(generated.variants.posterThumbSm?.formats?.avif?.size).toBeLessThanOrEqual(9_000);
    expect(generated.variants.posterThumb?.formats?.avif?.size).toBeLessThanOrEqual(46_000);
  }, 15_000);
});
