import { describe, expect, it } from "vitest";

import { preloadPublicRoute } from "@/routes/public-preload";

describe("preloadPublicRoute", () => {
  it("does not inject document prefetch links for public routes", () => {
    const initialLinkCount = document.head.querySelectorAll('link[rel="prefetch"]').length;

    preloadPublicRoute("/postagem/exemplo");

    expect(document.head.querySelectorAll('link[rel="prefetch"]').length).toBe(initialLinkCount);
  });

  it("ignores invalid paths", () => {
    const initialLinkCount = document.head.querySelectorAll('link[rel="prefetch"]').length;

    preloadPublicRoute("https://example.com/fora");

    expect(document.head.querySelectorAll('link[rel="prefetch"]').length).toBe(initialLinkCount);
  });
});
