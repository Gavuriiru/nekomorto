import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  attachUploadMediaMetadata,
  generateUploadVariants,
  normalizeFocalPoints,
  normalizeVariants,
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

    expect(result.focalPoint).toEqual({ x: 0.5, y: 0.8025 });
    expect(result.focalPoints).toEqual({
      card: { x: 0.5, y: 0.8025 },
      hero: { x: 0.5, y: 0.8 },
    });
    expect(result.focalCrops).toEqual({
      card: { left: 0, top: 0.635, width: 1, height: 0.335 },
      hero: { left: 0, top: 0.66, width: 1, height: 0.28 },
    });
  });

  it("gera presets publicos incluindo poster e square", async () => {
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
        card: { left: 0, top: 0, width: 1, height: 67 / 200 },
        hero: { left: 0, top: 144 / 200, width: 1, height: 56 / 200 },
      },
      variantsVersion: 1,
    });

    const cardPath = toDiskPath(uploadsDir, String(generated.variants.card?.formats?.fallback?.url || ""));
    const cardWidePath = toDiskPath(
      uploadsDir,
      String(generated.variants.cardWide?.formats?.fallback?.url || ""),
    );
    const ogPath = toDiskPath(uploadsDir, String(generated.variants.og?.formats?.fallback?.url || ""));
    const heroPath = toDiskPath(uploadsDir, String(generated.variants.hero?.formats?.fallback?.url || ""));
    const posterPath = toDiskPath(
      uploadsDir,
      String(generated.variants.poster?.formats?.fallback?.url || ""),
    );
    const squarePath = toDiskPath(
      uploadsDir,
      String(generated.variants.square?.formats?.fallback?.url || ""),
    );
    const cardMeta = await sharp(cardPath).metadata();
    const cardWideMeta = await sharp(cardWidePath).metadata();
    const ogMeta = await sharp(ogPath).metadata();
    const heroMeta = await sharp(heroPath).metadata();
    const posterMeta = await sharp(posterPath).metadata();
    const squareMeta = await sharp(squarePath).metadata();
    const cardStats = await sharp(cardPath).stats();
    const cardWideStats = await sharp(cardWidePath).stats();
    const ogStats = await sharp(ogPath).stats();
    const heroStats = await sharp(heroPath).stats();

    expect(generated.variants).not.toHaveProperty("thumb");
    expect(generated.variants).toHaveProperty("cardWide");
    expect(cardMeta.width).toBe(1280);
    expect(cardMeta.height).toBe(853);
    expect(cardWideMeta.width).toBe(1280);
    expect(cardWideMeta.height).toBe(720);
    expect(ogMeta.width).toBe(1200);
    expect(ogMeta.height).toBe(675);
    expect(heroMeta.width).toBe(1600);
    expect(heroMeta.height).toBe(900);
    expect(posterMeta.width).toBe(920);
    expect(posterMeta.height).toBe(1300);
    expect(squareMeta.width).toBe(512);
    expect(squareMeta.height).toBe(512);
    expect(cardStats.channels[0]?.mean ?? 0).toBeGreaterThan(cardStats.channels[2]?.mean ?? 0);
    expect(cardWideStats.channels[0]?.mean ?? 0).toBeGreaterThan(cardWideStats.channels[2]?.mean ?? 0);
    expect(ogStats.channels[0]?.mean ?? 0).toBeGreaterThan(ogStats.channels[2]?.mean ?? 0);
    expect(heroStats.channels[2]?.mean ?? 0).toBeGreaterThan(heroStats.channels[0]?.mean ?? 0);
  });

  it("preserva presets extras ao normalizar variants existentes", () => {
    const normalized = normalizeVariants({
      poster: {
        width: 920,
        height: 1300,
        formats: {
          fallback: { url: "/uploads/_variants/u1/poster-v2.jpeg" },
        },
      },
      square: {
        width: 512,
        height: 512,
        formats: {
          fallback: { url: "/uploads/_variants/u1/square-v2.png" },
        },
      },
    });

    expect(normalized.poster?.formats?.fallback?.url).toBe("/uploads/_variants/u1/poster-v2.jpeg");
    expect(normalized.square?.formats?.fallback?.url).toBe("/uploads/_variants/u1/square-v2.png");
  });

  it("nao gera variants para uploads nao raster", async () => {
    await expect(
      generateUploadVariants({
        uploadsDir: createTempUploadsDir(),
        uploadId: "upload-svg",
        sourceMime: "image/svg+xml",
      }),
    ).resolves.toEqual({
      variants: {},
      sourceWidth: null,
      sourceHeight: null,
      variantBytes: 0,
    });
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
