import { describe, expect, it } from "vitest";

import { normalizeAssetUrl } from "@/lib/asset-url";

describe("asset-url", () => {
  it("returns empty string for empty values", () => {
    expect(normalizeAssetUrl("")).toBe("");
    expect(normalizeAssetUrl(null)).toBe("");
    expect(normalizeAssetUrl(undefined)).toBe("");
  });

  it("normalizes relative paths to same-origin absolute URLs", () => {
    expect(normalizeAssetUrl("/uploads/posts/image.png?x=1#preview")).toBe(
      `${window.location.origin}/uploads/posts/image.png?x=1#preview`,
    );
  });

  it("rewrites absolute upload URLs from any host to same-origin", () => {
    expect(normalizeAssetUrl("https://legacy.example.com/uploads/posts/a.png?cache=1")).toBe(
      `${window.location.origin}/uploads/posts/a.png?cache=1`,
    );
    expect(normalizeAssetUrl("http://127.0.0.1:8080/uploads/projects/capa.webp")).toBe(
      `${window.location.origin}/uploads/projects/capa.webp`,
    );
  });

  it("keeps external non-upload URLs unchanged", () => {
    expect(normalizeAssetUrl("https://cdn.example.com/images/a.png")).toBe(
      "https://cdn.example.com/images/a.png",
    );
  });

  it("keeps invalid absolute values unchanged", () => {
    expect(normalizeAssetUrl("not a valid url")).toBe("not a valid url");
  });
});
