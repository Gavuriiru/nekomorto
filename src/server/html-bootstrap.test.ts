import { describe, expect, it } from "vitest";

import {
  injectBootstrapGlobals,
  injectPreloadLinks,
} from "../../server/lib/html-bootstrap.js";

describe("html bootstrap injection", () => {
  it("injeta bootstrap publico/settings com bootstrap-init inline e preload critico", () => {
    const baseHtml =
      "<!doctype html><html><head><!-- APP_PRELOADS --><!-- APP_BOOTSTRAP --></head><body></body></html>";
    const withBootstrap = injectBootstrapGlobals({
      html: baseHtml,
      publicBootstrap: {
        settings: { site: { name: "Nekomata" } },
        projects: [],
        posts: [],
      },
      settings: { site: { name: "Nekomata" } },
    });
    const result = injectPreloadLinks({
      html: withBootstrap,
      preloads: [{ href: "/uploads/_variants/hero-v1.jpeg", as: "image", fetchpriority: "high" }],
    });

    expect(result).toContain("window.__BOOTSTRAP_PUBLIC__ = ");
    expect(result).toContain("window.__BOOTSTRAP_SETTINGS__ = ");
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC_PROMISE__");
    expect(result).toContain("fetch('/api/public/bootstrap'");
    expect(result).toContain('rel="preload"');
    expect(result).toContain('href="/uploads/_variants/hero-v1.jpeg"');
    expect(result).toContain('as="image"');
    expect(result).toContain('fetchpriority="high"');
  });

  it("injeta somente script inline no marker de bootstrap", () => {
    const result = injectBootstrapGlobals({
      html: "<!doctype html><html><head><!-- APP_BOOTSTRAP --></head><body></body></html>",
      publicBootstrap: {
        settings: {},
        projects: [],
        posts: [],
      },
      settings: {},
    });

    expect(result).toContain("<script>");
    expect(result).not.toContain('<script src="/bootstrap-init.js"></script>');
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC__ = ");
  });

  it("escapa payload inline para nao quebrar o HTML", () => {
    const result = injectBootstrapGlobals({
      html: "<html><head><!-- APP_BOOTSTRAP --></head></html>",
      publicBootstrap: {
        settings: {},
        projects: [{ title: "</script><script>alert(1)</script>" }],
        posts: [],
      },
      settings: {},
    });

    expect(result).not.toContain("</script><script>alert(1)</script>");
    expect(result).toContain("\\u003C/script\\u003E");
  });
});
