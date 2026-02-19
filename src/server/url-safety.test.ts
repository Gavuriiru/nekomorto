import { describe, expect, it } from "vitest";

import {
  sanitizeAssetUrl,
  sanitizeIconSource,
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
    expect(sanitizeAssetUrl("https://cdn.exemplo.com/logo.svg")).toBe("https://cdn.exemplo.com/logo.svg");
    expect(sanitizeAssetUrl("/uploads/branding/logo.svg")).toBe("/uploads/branding/logo.svg");
    expect(sanitizeAssetUrl("//cdn.exemplo.com/logo.svg")).toBeNull();
    expect(sanitizeAssetUrl("mailto:admin@example.com")).toBeNull();
    expect(sanitizeAssetUrl("data:image/svg+xml;base64,xxx")).toBeNull();
  });

  it("sanitizeIconSource accepts only icon key, https or /uploads", () => {
    expect(sanitizeIconSource("instagram")).toBe("instagram");
    expect(sanitizeIconSource("InStaGram")).toBe("instagram");
    expect(sanitizeIconSource("https://cdn.exemplo.com/icon.svg")).toBe("https://cdn.exemplo.com/icon.svg");
    expect(sanitizeIconSource("/uploads/socials/icon.svg")).toBe("/uploads/socials/icon.svg");
    expect(sanitizeIconSource("http://cdn.exemplo.com/icon.svg")).toBeNull();
    expect(sanitizeIconSource("data:image/svg+xml,<svg/>")).toBeNull();
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
});
