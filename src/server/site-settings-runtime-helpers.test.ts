import { describe, expect, it } from "vitest";

import {
  createSiteSettingsRuntimeHelpers,
  defaultSiteSettings,
  fixMojibakeDeep,
} from "../../server/lib/site-settings-runtime-helpers.js";

describe("site-settings-runtime-helpers", () => {
  it("normalizes upload urls recursively against the primary origin", () => {
    const { normalizeUploadsDeep } = createSiteSettingsRuntimeHelpers({
      primaryAppOrigin: "https://example.com",
    });

    expect(
      normalizeUploadsDeep({
        cover: "https://example.com/uploads/project/cover.png?size=2",
        nested: [
          "See https://example.com/uploads/project/page-1.png and keep it relative",
          "https://other.example.com/ignore.png",
        ],
      }),
    ).toEqual({
      cover: "/uploads/project/cover.png?size=2",
      nested: [
        "See /uploads/project/page-1.png and keep it relative",
        "https://other.example.com/ignore.png",
      ],
    });
  });

  it("normalizes site settings and preserves current compatibility fields", () => {
    const { normalizeSiteSettings } = createSiteSettingsRuntimeHelpers({
      primaryAppOrigin: "https://example.com",
    });

    const normalized = normalizeSiteSettings({
      site: {
        name: " Example ",
        faviconUrl: "https://example.com/uploads/favicon.png",
      },
      navbar: {
        links: [
          { label: " Blog ", href: "javascript:alert(1)", icon: "home" },
          { label: "Equipe", href: "/equipe" },
        ],
      },
      branding: {
        wordmarkEnabled: true,
        wordmarkPlacement: "navbar",
        wordmarkUrlNavbar: "https://example.com/uploads/wordmark-navbar.png",
      },
      community: {
        discordUrl: "https://discord.com/invite/BAHKhdX2ju",
        inviteCard: {
          ctaUrl: "javascript:alert(1)",
        },
      },
      footer: {
        socialLinks: [
          { label: "Discord", href: "" },
          { label: "Site", href: "javascript:alert(1)" },
        ],
      },
      seo: {
        redirects: [{ from: "/old", to: "/new" }],
      },
    });

    expect(normalized.site.name).toBe("Example");
    expect(normalized.site.faviconUrl).toBe("/uploads/favicon.png");
    expect(normalized.navbar.links).toEqual([{ label: "Equipe", href: "/equipe", icon: "users" }]);
    expect(normalized.branding.display.navbar).toBe("symbol-text");
    expect(normalized.branding.wordmarkPlacement).toBe("navbar");
    expect(normalized.branding.wordmarkUrlNavbar).toBe("/uploads/wordmark-navbar.png");
    expect(normalized.community.inviteCard.ctaUrl).toBe("https://discord.com/invite/BAHKhdX2ju");
    expect(normalized.footer.socialLinks).toEqual([
      { label: "Discord", href: "https://discord.com/invite/BAHKhdX2ju" },
    ]);
    expect(normalized.seo.redirects).toEqual([
      { id: "redirect-1", from: "/old", to: "/new", enabled: true },
    ]);
  });

  it("builds persisted site settings payloads without legacy storage keys", () => {
    const { buildSiteSettingsStoragePayload } = createSiteSettingsRuntimeHelpers({
      primaryAppOrigin: "https://example.com",
    });

    expect(
      buildSiteSettingsStoragePayload({
        branding: {
          wordmarkUrl: "/uploads/wordmark.png",
          wordmarkUrlNavbar: "/uploads/wordmark-navbar.png",
          assets: {
            symbolUrl: "/uploads/symbol.png",
          },
        },
        site: {
          logoUrl: "/uploads/logo.png",
          name: "Example",
        },
        footer: {
          brandLogoUrl: "/uploads/footer-logo.png",
          brandName: "Example",
        },
      }),
    ).toEqual({
      branding: {
        assets: {
          symbolUrl: "/uploads/symbol.png",
        },
      },
      site: {
        name: "Example",
      },
      footer: {
        brandName: "Example",
      },
    });
  });

  it("fixes mojibake strings deeply and exposes the default settings catalog", () => {
    expect(fixMojibakeDeep({ title: "LanÃ§amento" })).toEqual({ title: "Lançamento" });
    expect(defaultSiteSettings.site.name).toBe("NEKOMATA");
  });
});
