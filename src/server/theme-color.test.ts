import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_COLOR, resolveThemeColor } from "../../server/lib/theme-color.js";

describe("theme color resolver (server)", () => {
  it("expands shorthand hex values to six lowercase digits", () => {
    expect(resolveThemeColor("#abc")).toBe("#aabbcc");
  });

  it("normalizes full hex values to lowercase", () => {
    expect(resolveThemeColor("#34A853")).toBe("#34a853");
  });

  it("falls back to the default accent on invalid or empty values", () => {
    expect(resolveThemeColor("oops")).toBe(DEFAULT_THEME_COLOR);
    expect(resolveThemeColor("")).toBe(DEFAULT_THEME_COLOR);
    expect(resolveThemeColor(undefined)).toBe(DEFAULT_THEME_COLOR);
  });
});
