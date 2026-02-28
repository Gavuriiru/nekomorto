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
  it("expande foco legado para todos os presets e preserva merge por preset", () => {
    const focalPoints = normalizeFocalPoints(
      {
        hero: { x: 0.9, y: 0.1 },
      },
      { x: 0.2, y: 0.8 },
    );

    expect(focalPoints.thumb).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.card).toEqual({ x: 0.2, y: 0.8 });
    expect(focalPoints.hero).toEqual({ x: 0.9, y: 0.1 });
    expect(focalPoints.og).toEqual({ x: 0.2, y: 0.8 });
  });

  it("migra uploads legados para focalPoints e mantem focalPoint como alias", async () => {
    const result = await attachUploadMediaMetadata({
      uploadsDir: createTempUploadsDir(),
      entry: {
        id: "upload-legacy",
        folder: "posts",
        focalPoint: { x: 0.2, y: 0.8 },
        variants: {},
        variantsVersion: 1,
      },
      hashSha256: "abc123",
      regenerateVariants: false,
    });

    expect(result.focalPoint).toEqual({ x: 0.2, y: 0.8 });
    expect(result.focalPoints).toEqual({
      thumb: { x: 0.2, y: 0.8 },
      card: { x: 0.2, y: 0.8 },
      hero: { x: 0.2, y: 0.8 },
      og: { x: 0.2, y: 0.8 },
    });
  });

  it("gera variantes usando o foco especifico de cada preset", async () => {
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
      focalPoints: {
        thumb: { x: 0.5, y: 0 },
        card: { x: 0.5, y: 0.5 },
        hero: { x: 0.5, y: 1 },
        og: { x: 0.5, y: 0.5 },
      },
      variantsVersion: 1,
    });

    const thumbPath = toDiskPath(uploadsDir, String(generated.variants.thumb?.formats?.fallback?.url || ""));
    const heroPath = toDiskPath(uploadsDir, String(generated.variants.hero?.formats?.fallback?.url || ""));
    const thumbStats = await sharp(thumbPath).stats();
    const heroStats = await sharp(heroPath).stats();

    expect(thumbStats.channels[0]?.mean ?? 0).toBeGreaterThan(thumbStats.channels[2]?.mean ?? 0);
    expect(heroStats.channels[2]?.mean ?? 0).toBeGreaterThan(heroStats.channels[0]?.mean ?? 0);
  });
});
