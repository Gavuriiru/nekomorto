import { describe, expect, it } from "vitest";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { resolveBranding } from "@/lib/branding";

const createSettings = (override: unknown) =>
  mergeSettings(defaultSettings, override as Partial<SiteSettings>);

describe("resolveBranding", () => {
  it("prioritizes the new branding model and explicit overrides", () => {
    const settings = createSettings({
      site: { logoUrl: "/legacy-symbol.png" },
      footer: { brandLogoUrl: "/legacy-footer-symbol.png" },
      branding: {
        assets: {
          symbolUrl: "/new-symbol.png",
          wordmarkUrl: "/new-wordmark.png",
        },
        overrides: {
          navbarSymbolUrl: "/navbar-symbol.png",
          footerWordmarkUrl: "/footer-wordmark.png",
        },
        display: {
          navbar: "symbol",
          footer: "wordmark",
        },
      },
    });

    const branding = resolveBranding(settings);
    expect(branding.assets.symbolUrl).toBe("/new-symbol.png");
    expect(branding.navbar.symbolUrl).toBe("/navbar-symbol.png");
    expect(branding.navbar.mode).toBe("symbol");
    expect(branding.navbar.showWordmark).toBe(false);
    expect(branding.footer.mode).toBe("wordmark");
    expect(branding.footer.wordmarkUrl).toBe("/footer-wordmark.png");
    expect(branding.footer.symbolUrl).toBe("/new-symbol.png");
  });

  it("falls back to legacy values when the new model is missing", () => {
    const settings = createSettings({
      site: { logoUrl: "/legacy-symbol.png" },
      branding: {
        wordmarkEnabled: true,
        wordmarkPlacement: "navbar",
        wordmarkUrl: "/legacy-wordmark.png",
        wordmarkUrlNavbar: "/legacy-navbar-wordmark.png",
        display: {
          navbar: "invalid",
          footer: "invalid",
        },
      },
    });

    const branding = resolveBranding(settings);
    expect(branding.assets.symbolUrl).toBe("/legacy-symbol.png");
    expect(branding.assets.wordmarkUrl).toBe("/legacy-wordmark.png");
    expect(branding.navbar.mode).toBe("wordmark");
    expect(branding.footer.mode).toBe("symbol-text");
    expect(branding.navbar.wordmarkUrl).toBe("/legacy-navbar-wordmark.png");
  });

  it("uses legacy footer symbol only when no symbol asset is available", () => {
    const settings = createSettings({
      site: { logoUrl: "" },
      footer: { brandLogoUrl: "/legacy-footer-symbol.png" },
      branding: {
        assets: { symbolUrl: "" },
      },
    });

    const branding = resolveBranding(settings);
    expect(branding.navbar.symbolUrl).toBe("");
    expect(branding.footer.symbolUrl).toBe("/legacy-footer-symbol.png");
  });

  it("keeps the existing wordmark fallback chain between sections", () => {
    const settings = createSettings({
      branding: {
        assets: { wordmarkUrl: "/main-wordmark.png" },
        overrides: { footerWordmarkUrl: "/footer-wordmark.png" },
        display: { navbar: "wordmark" },
      },
    });

    const branding = resolveBranding(settings);
    expect(branding.navbar.wordmarkUrl).toBe("/footer-wordmark.png");
    expect(branding.footer.wordmarkUrl).toBe("/footer-wordmark.png");
    expect(branding.navbar.showWordmark).toBe(true);
  });

  it("accepts text mode for navbar", () => {
    const settings = createSettings({
      branding: {
        display: { navbar: "text" },
      },
    });

    const branding = resolveBranding(settings);
    expect(branding.navbar.mode).toBe("text");
    expect(branding.navbar.showWordmark).toBe(false);
  });
});
