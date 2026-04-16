import { describe, expect, it } from "vitest";

import {
  parseSafeUrlValue,
  sanitizeAssetUrl,
  sanitizeFavoriteWorksByCategory,
  sanitizeIconSource,
  sanitizeLocalAssetHref,
  sanitizePublicHref,
  sanitizeSocials,
} from "../../server/lib/url-safety.js";

describe("server url-safety", () => {
  it("sanitizePublicHref allows only expected schemes and relative paths", () => {
    expect(sanitizePublicHref("https://example.com/path")).toBe("https://example.com/path");
    expect(sanitizePublicHref("/rota-interna?x=1")).toBe("/rota-interna?x=1");
    expect(sanitizePublicHref("mailto:admin@example.com")).toBe("mailto:admin@example.com");
    expect(sanitizePublicHref("tel:+5511999999999")).toBe("tel:+5511999999999");
    expect(sanitizePublicHref("//evil.example.com/path")).toBeNull();
    expect(sanitizePublicHref("javascript:alert(1)")).toBeNull();
    expect(sanitizePublicHref("data:text/html;base64,xxx")).toBeNull();
  });

  it("sanitizeAssetUrl blocks scriptable protocols", () => {
    expect(sanitizeAssetUrl("https://cdn.exemplo.com/logo.svg")).toBe(
      "https://cdn.exemplo.com/logo.svg",
    );
    expect(sanitizeAssetUrl("/uploads/branding/logo.svg")).toBe("/uploads/branding/logo.svg");
    expect(sanitizeAssetUrl("//cdn.exemplo.com/logo.svg")).toBeNull();
    expect(sanitizeAssetUrl("mailto:admin@example.com")).toBeNull();
    expect(sanitizeAssetUrl("data:image/svg+xml;base64,xxx")).toBeNull();
  });

  it("blocks mixed-case protocols and encoded control characters in URLs", () => {
    expect(sanitizePublicHref(" JaVaScRiPt:alert(1) ")).toBeNull();
    expect(sanitizePublicHref("java%0ascript:alert(1)")).toBeNull();
    expect(sanitizeAssetUrl("https://cdn.exemplo.com/%0aevil.svg")).toBeNull();
    expect(sanitizePublicHref("HTTPS://Example.com/Path")).toBe("https://example.com/Path");
  });

  it("sanitizeIconSource accepts only icon key, https or /uploads", () => {
    expect(sanitizeIconSource("instagram")).toBe("instagram");
    expect(sanitizeIconSource("InStaGram")).toBe("instagram");
    expect(sanitizeIconSource("https://cdn.exemplo.com/icon.svg")).toBe(
      "https://cdn.exemplo.com/icon.svg",
    );
    expect(sanitizeIconSource("/uploads/socials/icon.svg")).toBe("/uploads/socials/icon.svg");
    expect(sanitizeIconSource("http://cdn.exemplo.com/icon.svg")).toBeNull();
    expect(sanitizeIconSource("data:image/svg+xml,<svg/>")).toBeNull();
  });

  it("normalizes local asset hrefs with parsing instead of string includes", () => {
    expect(sanitizeLocalAssetHref("/assets/app.css")).toBe("/assets/app.css");
    expect(
      sanitizeLocalAssetHref("/fonts/inter/InterLatin.woff2", {
        allowedPrefixes: ["/assets/", "/fonts/"],
      }),
    ).toBe("/fonts/inter/InterLatin.woff2");
    expect(sanitizeLocalAssetHref("//evil.example.com/assets/app.css")).toBeNull();
    expect(sanitizeLocalAssetHref("/assets/%0aapp.css")).toBeNull();
  });

  it("parses only safe URL values when a base URL is provided", () => {
    expect(parseSafeUrlValue("/uploads/a.svg", { baseUrl: "https://example.com" })?.toString()).toBe(
      "https://example.com/uploads/a.svg",
    );
    expect(parseSafeUrlValue("#chapter-1", { baseUrl: "https://example.com/book" })?.toString()).toBe(
      "https://example.com/book#chapter-1",
    );
    expect(parseSafeUrlValue("data:text/html,boom", { baseUrl: "https://example.com" })).toBeNull();
  });

  it("sanitizeSocials removes invalid/duplicate entries", () => {
    const socials = sanitizeSocials([
      { label: "Discord", href: "https://discord.gg/nekomata" },
      { label: "Discord", href: "https://discord.gg/nekomata" },
      { label: "X", href: "javascript:alert(1)" },
      { label: "Site", href: "/sobre" },
      { label: "", href: "https://example.com" },
    ]);

    expect(socials).toEqual([
      { label: "Discord", href: "https://discord.gg/nekomata" },
      { label: "Site", href: "/sobre" },
    ]);
  });

  it("sanitizeFavoriteWorksByCategory normalizes lists and ignores legacy format", () => {
    const longTitle = "A".repeat(120);
    const favoriteWorks = sanitizeFavoriteWorksByCategory({
      manga: ["  Naruto  ", "naruto", "", longTitle, "Bleach"],
      anime: ["One Piece", "ONE PIECE", "Frieren", "Haikyuu"],
    });

    expect(favoriteWorks).toEqual({
      manga: ["Naruto", "A".repeat(80), "Bleach"],
      anime: ["One Piece", "Frieren", "Haikyuu"],
    });
    expect(sanitizeFavoriteWorksByCategory(["legacy"])).toEqual({
      manga: [],
      anime: [],
    });
    expect(sanitizeFavoriteWorksByCategory("not-an-object")).toEqual({
      manga: [],
      anime: [],
    });
  });
});
