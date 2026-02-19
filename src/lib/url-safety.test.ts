import { describe, expect, it } from "vitest";

import { isIconUrlSource, sanitizeIconSource, sanitizePublicHref } from "@/lib/url-safety";

describe("frontend url-safety", () => {
  it("sanitizePublicHref accepts only allowed schemes and safe relative paths", () => {
    expect(sanitizePublicHref("https://example.com")).toBe("https://example.com/");
    expect(sanitizePublicHref("/equipe")).toBe("/equipe");
    expect(sanitizePublicHref("mailto:admin@example.com")).toBe("mailto:admin@example.com");
    expect(sanitizePublicHref("tel:+5511999999999")).toBe("tel:+5511999999999");
    expect(sanitizePublicHref("//evil.example.com")).toBeNull();
    expect(sanitizePublicHref("javascript:alert(1)")).toBeNull();
  });

  it("sanitizeIconSource allows only icon key, https and /uploads", () => {
    expect(sanitizeIconSource("instagram")).toBe("instagram");
    expect(sanitizeIconSource("https://cdn.exemplo.com/icon.svg")).toBe("https://cdn.exemplo.com/icon.svg");
    expect(sanitizeIconSource("/uploads/socials/icon.svg")).toBe("/uploads/socials/icon.svg");
    expect(sanitizeIconSource("http://cdn.exemplo.com/icon.svg")).toBeNull();
    expect(sanitizeIconSource("data:image/svg+xml,<svg/>")).toBeNull();
  });

  it("isIconUrlSource returns true only for URL-based icon sources", () => {
    expect(isIconUrlSource("https://cdn.exemplo.com/icon.svg")).toBe(true);
    expect(isIconUrlSource("/uploads/socials/icon.svg")).toBe(true);
    expect(isIconUrlSource("instagram")).toBe(false);
  });
});
