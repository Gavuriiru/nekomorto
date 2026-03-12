import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { OG_MAX_RECOMMENDED_BYTES, optimizeOgPngBuffer } from "../../server/lib/og-image-output.js";

describe("og image output helper", () => {
  it("returns original buffer when already below max size", async () => {
    const input = Buffer.from("tiny-png");
    const optimized = await optimizeOgPngBuffer({
      buffer: input,
      maxBytes: 1024,
    });

    expect(optimized).toBe(input);
  });

  it("compresses png when buffer is above max size", async () => {
    const width = 420;
    const height = 260;
    const random = Buffer.alloc(width * height * 3);
    for (let index = 0; index < random.length; index += 1) {
      random[index] = (index * 31) % 256;
    }
    const rawPng = await sharp(random, {
      raw: { width, height, channels: 3 },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const optimized = await optimizeOgPngBuffer({
      buffer: rawPng,
      maxBytes: Math.floor(rawPng.length * 0.6),
    });

    expect(Buffer.isBuffer(optimized)).toBe(true);
    expect(optimized.length).toBeLessThan(rawPng.length);
  });

  it("keeps project OG compression lossless and returns the original buffer when recompression does not improve", async () => {
    const width = 320;
    const height = 180;
    const raw = Buffer.alloc(width * height * 4);
    for (let index = 0; index < raw.length; index += 1) {
      raw[index] = (index * 17) % 256;
    }
    const alreadyCompressed = await sharp(raw, {
      raw: { width, height, channels: 4 },
    })
      .png({ palette: false, compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    const optimized = await optimizeOgPngBuffer({
      buffer: alreadyCompressed,
      maxBytes: Math.floor(alreadyCompressed.length * 0.5),
      mode: "lossless",
    });

    expect(optimized).toBe(alreadyCompressed);
  });

  it("uses non-palette lossless compression when it can still reduce the file", async () => {
    const width = 420;
    const height = 260;
    const raw = Buffer.alloc(width * height * 4);
    for (let index = 0; index < raw.length; index += 1) {
      raw[index] = (index * 29) % 256;
    }
    const uncompressed = await sharp(raw, {
      raw: { width, height, channels: 4 },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const optimized = await optimizeOgPngBuffer({
      buffer: uncompressed,
      maxBytes: Math.floor(uncompressed.length * 0.5),
      mode: "lossless",
    });
    const metadata = await sharp(optimized).metadata();

    expect(optimized.length).toBeLessThan(uncompressed.length);
    expect(metadata.paletteBitDepth).toBeUndefined();
  });

  it("falls back to original buffer when png optimization fails", async () => {
    const invalid = Buffer.alloc(OG_MAX_RECOMMENDED_BYTES + 8, 1);
    const optimized = await optimizeOgPngBuffer({
      buffer: invalid,
      maxBytes: OG_MAX_RECOMMENDED_BYTES,
    });

    expect(optimized).toBe(invalid);
  });
});
