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

  it("falls back to original buffer when png optimization fails", async () => {
    const invalid = Buffer.alloc(OG_MAX_RECOMMENDED_BYTES + 8, 1);
    const optimized = await optimizeOgPngBuffer({
      buffer: invalid,
      maxBytes: OG_MAX_RECOMMENDED_BYTES,
    });

    expect(optimized).toBe(invalid);
  });
});
