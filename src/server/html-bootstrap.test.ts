import { describe, expect, it } from "vitest";

import {
  extractLocalStylesheetHrefs,
  injectBootstrapGlobals,
  injectHomeHeroShell,
  injectPreloadLinks,
} from "../../server/lib/html-bootstrap.js";
import {
  resolvePublicPostCoverPreload,
  resolvePublicReaderHeroPreload,
} from "../../server/lib/public-media-variants.js";

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
      publicMe: {
        id: "user-1",
        name: "Admin",
      },
    });
    const result = injectPreloadLinks({
      html: withBootstrap,
      preloads: [
        {
          href: "/uploads/_variants/hero-v1.avif",
          as: "image",
          type: "image/avif",
          imagesrcset:
            "/uploads/_variants/heroSm-v1.avif 960w, /uploads/_variants/heroMd-v1.avif 1280w, /uploads/_variants/hero-v1.avif 1600w",
          imagesizes: "100vw",
          fetchpriority: "high",
        },
      ],
    });

    expect(result).toContain("window.__BOOTSTRAP_PUBLIC__ = ");
    expect(result).toContain("window.__BOOTSTRAP_SETTINGS__ = ");
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC_ME__ = ");
    expect(result).toContain("window.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ = false");
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC_PROMISE__");
    expect(result).toContain("resolveThemeColorSection");
    expect(result).toContain("window.location.pathname");
    expect(result).toContain("fetch('/api/public/bootstrap'");
    expect(result).toContain('rel="preload"');
    expect(result).toContain('href="/uploads/_variants/hero-v1.avif"');
    expect(result).toContain('as="image"');
    expect(result).toContain('type="image/avif"');
    expect(result).toContain('imagesrcset="/uploads/_variants/heroSm-v1.avif 960w, /uploads/_variants/heroMd-v1.avif 1280w, /uploads/_variants/hero-v1.avif 1600w"');
    expect(result).toContain('imagesizes="100vw"');
    expect(result).toContain('fetchpriority="high"');
  });

  it("extrai apenas hrefs locais de stylesheet para preload", () => {
    const html =
      '<html><head><link rel="stylesheet" href="/assets/index-abc.css"><link rel="preload" href="/assets/other.css" as="style"><link href="/assets/theme-def.css" rel="stylesheet"><link rel="stylesheet" href="https://cdn.exemplo.com/site.css"></head></html>';

    expect(extractLocalStylesheetHrefs(html)).toEqual([
      "/assets/index-abc.css",
      "/assets/theme-def.css",
    ]);
  });

  it("deduplica preload por href+as e preserva atributos opcionais", () => {
    const result = injectPreloadLinks({
      html: "<html><head><!-- APP_PRELOADS --></head></html>",
      preloads: [
        { href: "/assets/index-abc.css", as: "style", crossorigin: "anonymous" },
        { href: "/assets/index-abc.css", as: "style", crossorigin: "anonymous" },
        {
          href: "/uploads/hero.avif",
          as: "image",
          type: "image/avif",
          imagesrcset: "/uploads/hero-sm.avif 960w, /uploads/hero.avif 1600w",
          imagesizes: "100vw",
          fetchpriority: "high",
          media: "(min-width: 768px)",
        },
      ],
    });

    expect((result.match(/href="\/assets\/index-abc\.css"/g) || []).length).toBe(1);
    expect(result).toContain('as="style"');
    expect(result).toContain('crossorigin="anonymous"');
    expect(result).toContain('href="/uploads/hero.avif"');
    expect(result).toContain('type="image/avif"');
    expect(result).toContain('imagesrcset="/uploads/hero-sm.avif 960w, /uploads/hero.avif 1600w"');
    expect(result).toContain('imagesizes="100vw"');
    expect(result).toContain('fetchpriority="high"');
    expect(result).toContain('media="(min-width: 768px)"');
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
      publicMe: null,
    });

    expect(result).toContain("<script>");
    expect(result).not.toContain('<script src="/bootstrap-init.js"></script>');
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC__ = ");
  });

  it("permite bootstrap leve sem fetch publico inicial", () => {
    const result = injectBootstrapGlobals({
      html: "<!doctype html><html><head><!-- APP_BOOTSTRAP --></head><body></body></html>",
      publicBootstrap: null,
      settings: { site: { name: "Nekomata" } },
      publicMe: { id: "user-1", name: "Admin" },
      skipPublicFetch: true,
    });

    expect(result).toContain("window.__BOOTSTRAP_PUBLIC__ = null");
    expect(result).toContain("window.__BOOTSTRAP_SETTINGS__ = ");
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC_ME__ = ");
    expect(result).toContain("window.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ = true");
    expect(result).toContain("window.__BOOTSTRAP_PUBLIC_PROMISE__");
    expect(result).toContain("fetch('/api/public/bootstrap'");
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
      publicMe: { id: "user-1", name: "</script><script>alert(2)</script>" },
    });

    expect(result).not.toContain("</script><script>alert(1)</script>");
    expect(result).not.toContain("</script><script>alert(2)</script>");
    expect(result).toContain("\\u003C/script\\u003E");
  });

  it("injeta shell estatico da home no marcador dedicado", () => {
    const result = injectHomeHeroShell({
      html: "<!doctype html><html><body><!-- APP_HOME_HERO_SHELL --><div id=\"root\"></div></body></html>",
      shellMarkup: "<div id=\"home-hero-shell\"></div>",
    });

    expect(result).toContain("<!-- APP_HOME_HERO_SHELL -->");
    expect(result).toContain('<div id="home-hero-shell"></div>');
  });

  it("gera preload do LCP da postagem no HTML", () => {
    const preload = resolvePublicPostCoverPreload({
      coverUrl: "/uploads/posts/post-1-cover.jpg",
      mediaVariants: {
        "/uploads/posts/post-1-cover.jpg": {
          variantsVersion: 1,
          variants: {
            card: {
              formats: {
                fallback: { url: "/uploads/_variants/post-1/card-v1.jpeg" },
              },
            },
          },
        },
      },
      resolveVariantUrl: () => "",
    });

    const result = injectPreloadLinks({
      html: "<!doctype html><html><head><!-- APP_PRELOADS --></head><body></body></html>",
      preloads: preload ? [preload] : [],
    });

    expect(result).toContain('href="/uploads/_variants/post-1/card-v1.jpeg"');
    expect(result).toContain('as="image"');
    expect(result).toContain('fetchpriority="high"');
  });

  it("gera preload responsivo da hero de leitura no HTML", () => {
    const preload = resolvePublicReaderHeroPreload({
      imageUrl: "/uploads/projects/project-1/hero.jpg",
      mediaVariants: {
        "/uploads/projects/project-1/hero.jpg": {
          variantsVersion: 1,
          variants: {
            heroSm: {
              width: 960,
              height: 540,
              formats: {
                avif: { url: "/uploads/_variants/project-1/heroSm-v1.avif" },
              },
            },
            hero: {
              width: 1600,
              height: 900,
              formats: {
                avif: { url: "/uploads/_variants/project-1/hero-v1.avif" },
              },
            },
          },
        },
      },
      resolveVariantUrl: () => "",
    });

    const result = injectPreloadLinks({
      html: "<!doctype html><html><head><!-- APP_PRELOADS --></head><body></body></html>",
      preloads: preload ? [preload] : [],
    });

    expect(result).toContain('href="/uploads/_variants/project-1/hero-v1.avif"');
    expect(result).toContain('type="image/avif"');
    expect(result).toContain(
      'imagesrcset="/uploads/_variants/project-1/heroSm-v1.avif 960w, /uploads/_variants/project-1/hero-v1.avif 1600w"',
    );
    expect(result).toContain('imagesizes="100vw"');
    expect(result).toContain('fetchpriority="high"');
  });
});
