import path from "path";
import { describe, expect, it } from "vitest";

import {
  buildPwaManifestPayload,
  resolveClientStaticAssetPath,
  resolvePwaCriticalAssetPath,
} from "../../server/lib/register-runtime-middleware.js";

describe("register-runtime-middleware asset resolution", () => {
  const clientDistDir = path.join("D:", "dist");

  it("resolves critical pwa assets from the dist root", () => {
    expect(
      resolvePwaCriticalAssetPath({
        clientDistDir,
        requestPath: "/manifest.webmanifest",
      }),
    ).toBe(path.join(clientDistDir, "manifest.webmanifest"));
    expect(
      resolvePwaCriticalAssetPath({
        clientDistDir,
        requestPath: "/sw.js",
      }),
    ).toBe(path.join(clientDistDir, "sw.js"));
    expect(
      resolvePwaCriticalAssetPath({
        clientDistDir,
        requestPath: "/workbox-abc123.js",
      }),
    ).toBe(path.join(clientDistDir, "workbox-abc123.js"));
  });

  it("resolves client static asset requests that should never fall through to html", () => {
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/assets/index-abc123.js",
      }),
    ).toBe(path.join(clientDistDir, "assets", "index-abc123.js"));
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/fonts/inter/InterLatin.woff2",
      }),
    ).toBe(path.join(clientDistDir, "fonts", "inter", "InterLatin.woff2"));
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/pwa/icon-192.png",
      }),
    ).toBe(path.join(clientDistDir, "pwa", "icon-192.png"));
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/favicon.ico",
      }),
    ).toBe(path.join(clientDistDir, "favicon.ico"));
  });

  it("keeps spa and api routes out of static asset handling", () => {
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/dashboard/posts",
      }),
    ).toBeNull();
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/api/public/bootstrap",
      }),
    ).toBeNull();
    expect(
      resolveClientStaticAssetPath({
        clientDistDir,
        requestPath: "/manifest.webmanifest",
      }),
    ).toBeNull();
  });
});

describe("buildPwaManifestPayload", () => {
  const pwaManifestBase = Object.freeze({
    id: "/",
    name: "Base Name",
    short_name: "Base Short",
    description: "Base description",
    start_url: "/",
  });

  it("prefers site settings for manifest name and description", () => {
    expect(
      buildPwaManifestPayload({
        loadSiteSettings: () => ({
          site: {
            name: "Neko Custom",
            description: "Descricao vinda das configuracoes",
          },
          theme: {
            mode: "light",
          },
        }),
        pwaManifestBase,
        pwaThemeColorDark: "#111111",
        pwaThemeColorLight: "#fafafa",
      }),
    ).toMatchObject({
      name: "Neko Custom",
      short_name: "Neko Custom",
      description: "Descricao vinda das configuracoes",
      theme_color: "#fafafa",
      background_color: "#fafafa",
    });
  });

  it("falls back to the base manifest fields when site settings are unavailable", () => {
    expect(
      buildPwaManifestPayload({
        loadSiteSettings: () => {
          throw new Error("settings unavailable");
        },
        pwaManifestBase,
        pwaThemeColorDark: "#111111",
        pwaThemeColorLight: "#fafafa",
      }),
    ).toMatchObject({
      name: "Base Name",
      short_name: "Base Short",
      description: "Base description",
      theme_color: "#111111",
      background_color: "#111111",
    });
  });
});
