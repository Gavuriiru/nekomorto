import { describe, expect, it } from "vitest";

import { isReservedPublicPath, normalizePublicPath } from "../../shared/public-paths.js";

describe("public path classification", () => {
  it("normalizes public paths before classification", () => {
    expect(normalizePublicPath("/assets//index.js?rev=1#hash")).toBe("/assets/index.js");
    expect(normalizePublicPath("/dashboard/posts/")).toBe("/dashboard/posts");
    expect(normalizePublicPath("https://example.com/assets/index.js")).toBe("");
  });

  it("marks reserved and asset-like paths as non-SPA routes", () => {
    expect(isReservedPublicPath("/assets/index-abc123.js")).toBe(true);
    expect(isReservedPublicPath("/foo.css")).toBe(true);
    expect(isReservedPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isReservedPublicPath("/workbox-abc123.js")).toBe(true);
    expect(isReservedPublicPath("/uploads/shared/hero.avif")).toBe(true);
    expect(isReservedPublicPath("/rss/posts.xml")).toBe(true);
  });

  it("keeps SPA routes eligible for HTML fallback", () => {
    expect(isReservedPublicPath("/")).toBe(false);
    expect(isReservedPublicPath("/dashboard/posts")).toBe(false);
    expect(isReservedPublicPath("/projeto/nekomata/leitura/12")).toBe(false);
    expect(isReservedPublicPath("/postagem/atualizacao-importante")).toBe(false);
  });
});
