import { describe, expect, it } from "vitest";

import {
  normalizeAvatarDisplay,
  sanitizeSvg,
  sanitizeUploadFolder,
  validateUploadImageBuffer,
  validateUploadRasterDimensions,
} from "../../server/lib/upload-runtime-helpers.js";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7J8AAAAASUVORK5CYII=",
  "base64",
);

describe("upload-runtime-helpers", () => {
  it("sanitizes upload folders while preserving caller-specific slash handling", () => {
    expect(sanitizeUploadFolder("/projects//demo/")).toBe("projects/demo/");
    expect(sanitizeUploadFolder("/projects//demo/", { trimTrailingSlash: true })).toBe(
      "projects/demo",
    );
  });

  it("normalizes avatar display values with stable defaults", () => {
    expect(normalizeAvatarDisplay({ x: 12, zoom: 0, rotation: 15 })).toEqual({
      x: 12,
      y: 0,
      zoom: 1,
      rotation: 15,
    });
    expect(normalizeAvatarDisplay(null)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
      rotation: 0,
    });
  });

  it("detects image mime from buffer and returns dimensions", () => {
    expect(validateUploadImageBuffer(ONE_BY_ONE_PNG, "image/jpeg")).toEqual({
      valid: true,
      mime: "image/png",
      dimensions: { width: 1, height: 1 },
    });
  });

  it("supports strict mime mismatch and svg size guards", () => {
    expect(
      validateUploadImageBuffer(ONE_BY_ONE_PNG, "image/webp", { strictRequestedMime: true }),
    ).toEqual({
      valid: false,
      error: "mime_mismatch",
    });

    expect(
      validateUploadImageBuffer(Buffer.alloc(0), "image/png", { requireBuffer: true }),
    ).toEqual({
      valid: false,
      error: "empty_upload",
    });

    expect(
      validateUploadImageBuffer(Buffer.from("<svg></svg>", "utf-8"), "image/svg+xml", {
        maxSvgSizeBytes: 4,
      }),
    ).toEqual({
      valid: false,
      error: "svg_too_large",
    });
  });

  it("sanitizes dangerous svg payloads", () => {
    const sanitized = sanitizeSvg(
      [
        '<svg onload="evil()">',
        "<script>alert(1)</script>",
        '<foreignObject><iframe src="https://evil.test"></iframe></foreignObject>',
        '<a href="jav&#x61;script:evil()"></a>',
        '<use href="#ok" />',
        '<use xlink:href="#shape" />',
        '<image href="/uploads/safe.svg" />',
        '<image xlink:href="JaVaScRiPt:evil()" />',
        '<image href="data:image/svg+xml;base64,PHN2Zz4=" />',
        "</svg>",
      ].join(""),
    );

    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("foreignObject");
    expect(sanitized).not.toContain("onload=");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("data:image");
    expect(sanitized).toContain('href="#ok"');
    expect(sanitized).toContain('href="#shape"');
    expect(sanitized).toContain('href="/uploads/safe.svg"');
  });

  it("validates raster dimensions consistently", () => {
    expect(validateUploadRasterDimensions({ width: 100, height: 200 })).toEqual({
      valid: true,
      dimensions: { width: 100, height: 200 },
    });
    expect(validateUploadRasterDimensions({ width: 9000, height: 10 })).toEqual({
      valid: false,
      error: "image_dimensions_too_large",
    });
  });
});
