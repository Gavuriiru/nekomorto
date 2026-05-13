import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildPublicPrerenderArtifactRelativePath,
  createPublicPrerenderRuntime,
  extractPublicPrerenderPathnamesFromSitemap,
  generatePublicPrerenderArtifact,
  isSupportedPublicPrerenderPathname,
  writePublicPrerenderManifest,
} from "../../server/lib/public-prerender-runtime.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "public-prerender-test-"));

describe("public-prerender-runtime", () => {
  const cleanupPaths: string[] = [];

  afterEach(() => {
    while (cleanupPaths.length > 0) {
      const target = cleanupPaths.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { force: true, recursive: true });
      }
    }
  });

  it("recognizes supported public prerender routes and stable artifact paths", () => {
    expect(isSupportedPublicPrerenderPathname("/")).toBe(true);
    expect(isSupportedPublicPrerenderPathname("/sobre")).toBe(true);
    expect(isSupportedPublicPrerenderPathname("/projeto/abc")).toBe(true);
    expect(isSupportedPublicPrerenderPathname("/postagem/slug-teste")).toBe(true);
    expect(isSupportedPublicPrerenderPathname("/projeto/abc/leitura/1")).toBe(false);
    expect(isSupportedPublicPrerenderPathname("/dashboard")).toBe(false);

    expect(buildPublicPrerenderArtifactRelativePath("/")).toBe("index.html");
    expect(buildPublicPrerenderArtifactRelativePath("/sobre")).toBe(
      path.join("sobre", "index.html"),
    );
    expect(buildPublicPrerenderArtifactRelativePath("/projeto/abc")).toBe(
      path.join("projeto", "abc", "index.html"),
    );
  });

  it("extracts supported prerender paths from sitemap XML", () => {
    const pathnames = extractPublicPrerenderPathnamesFromSitemap({
      primaryAppOrigin: "https://nekomata.example",
      xml: [
        "<urlset>",
        "  <url><loc>https://nekomata.example/</loc></url>",
        "  <url><loc>https://nekomata.example/sobre</loc></url>",
        "  <url><loc>https://nekomata.example/projeto/abc</loc></url>",
        "  <url><loc>https://nekomata.example/projeto/abc/leitura/1</loc></url>",
        "  <url><loc>https://nekomata.example/postagem/slug-teste</loc></url>",
        "</urlset>",
      ].join("\n"),
    });

    expect(pathnames).toEqual(["/", "/sobre", "/projeto/abc", "/postagem/slug-teste"]);
  });

  it("generates an artifact with SSR root markup and upgrades home bootstrap to full", async () => {
    const outputDir = createTempDir();
    cleanupPaths.push(outputDir);
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/public/bootstrap")) {
        return {
          json: async () => ({
            generatedAt: "2026-05-10T12:00:00.000Z",
            mediaVariants: {},
            pages: {},
            payloadMode: "full",
            posts: [],
            projects: [],
            settings: { site: { name: "Nekomata SSR" } },
            tagTranslations: { genres: {}, staffRoles: {}, tags: {} },
            teamLinkTypes: [],
            teamMembers: [],
            updates: [],
            inProgressItems: [],
            currentPostDetail: null,
            homeHero: null,
          }),
          ok: true,
        };
      }

      return {
        ok: true,
        text: async () =>
          [
            "<!doctype html>",
            "<html><head>",
            '<style data-home-hero-shell-critical>.shell{display:block}</style>',
            "</head><body>",
            '<div id="home-hero-shell" class="shell">shell</div>',
            '<div id="seo-snapshot">snapshot</div>',
            '<div id="root"></div>',
            "<script>",
            'window.__BOOTSTRAP_PUBLIC__ = {"settings":{"site":{"name":"Nekomata Shell"}},"pages":{},"projects":[],"inProgressItems":[],"posts":[],"updates":[],"teamMembers":[],"teamLinkTypes":[],"mediaVariants":{},"tagTranslations":{"tags":{},"genres":{},"staffRoles":{}},"homeHero":null,"currentPostDetail":null,"generatedAt":"2026-05-10T11:00:00.000Z","payloadMode":"critical-home"};',
            "window.__BOOTSTRAP_ROUTE__ = null;",
            'window.__BOOTSTRAP_SETTINGS__ = {"site":{"name":"Nekomata Shell"}};',
            "window.__BOOTSTRAP_PUBLIC_ME__ = null;",
            "window.__BOOTSTRAP_PWA_ENABLED__ = false;",
            "</script>",
            "</body></html>",
          ].join("\n"),
      };
    });

    const result = await generatePublicPrerenderArtifact({
      baseUrl: "http://127.0.0.1:43001",
      fetchImpl: fetchMock as unknown as typeof fetch,
      outputDir,
      pathname: "/",
      renderPublicApp: async ({ initialPublicBootstrap, pathname }) =>
        `<main data-path="${pathname}">${String(initialPublicBootstrap?.settings?.site?.name || "sem-nome")}</main>`,
    });

    const generatedHtml = fs.readFileSync(path.join(outputDir, result.filePath), "utf8");
    expect(generatedHtml).toContain('<div id="root"><main data-path="/">Nekomata SSR</main></div>');
    expect(generatedHtml).not.toContain("home-hero-shell");
    expect(generatedHtml).toContain('"payloadMode":"full"');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses stale prerender artifacts from a previous build fingerprint", async () => {
    const outputDir = createTempDir();
    cleanupPaths.push(outputDir);
    fs.mkdirSync(path.join(outputDir, "postagem", "slug-antigo"), { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "postagem", "slug-antigo", "index.html"),
      "<!doctype html><html><body><div id=\"root\">stale</div></body></html>",
      "utf8",
    );
    writePublicPrerenderManifest({
      buildFingerprint: "old-build",
      outputDir,
      routes: [
        {
          filePath: path.join("postagem", "slug-antigo", "index.html"),
          generatedAt: "2026-05-10T12:00:00.000Z",
          pathname: "/postagem/slug-antigo",
          revision: "rev-1",
        },
      ],
    });

    const enqueueCalls: string[] = [];
    const runtime = createPublicPrerenderRuntime({
      baseUrl: "http://127.0.0.1:43001",
      buildFingerprint: "new-build",
      enabled: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      getPublicVisiblePosts: () => [],
      getPublicVisibleProjects: () => [],
      outputDir,
      rendererModulePath: path.join(process.cwd(), "package.json"),
      sendHtml: vi.fn(async () => undefined),
    });

    vi.spyOn(runtime.queue, "enqueue").mockImplementation(async ({ payload }) => {
      enqueueCalls.push(String(payload?.reasons?.[0] || ""));
      return [];
    });

    const next = vi.fn();
    await runtime.middleware(
      {
        get: () => "",
        method: "GET",
        path: "/postagem/slug-antigo",
        query: {},
      },
      {},
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(enqueueCalls).toContain("stale-artifact:/postagem/slug-antigo");
  });

  it("bypasses prerender artifacts that reference missing client assets", async () => {
    const outputDir = createTempDir();
    cleanupPaths.push(outputDir);
    const clientDistDir = createTempDir();
    cleanupPaths.push(clientDistDir);
    fs.mkdirSync(path.join(outputDir, "sobre"), { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "sobre", "index.html"),
      [
        "<!doctype html>",
        "<html><head>",
        '<script type="module" src="/assets/index-stale.js"></script>',
        "</head><body><div id=\"root\">stale</div></body></html>",
      ].join(""),
      "utf8",
    );
    writePublicPrerenderManifest({
      buildFingerprint: "same-build",
      outputDir,
      routes: [
        {
          filePath: path.join("sobre", "index.html"),
          generatedAt: "2026-05-10T12:00:00.000Z",
          pathname: "/sobre",
          revision: "rev-1",
        },
      ],
    });

    const enqueueCalls: string[] = [];
    const runtime = createPublicPrerenderRuntime({
      baseUrl: "http://127.0.0.1:43001",
      buildFingerprint: "same-build",
      clientDistDir,
      enabled: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      getPublicVisiblePosts: () => [],
      getPublicVisibleProjects: () => [],
      outputDir,
      rendererModulePath: path.join(process.cwd(), "package.json"),
      sendHtml: vi.fn(async () => undefined),
    });

    vi.spyOn(runtime.queue, "enqueue").mockImplementation(async ({ payload }) => {
      enqueueCalls.push(String(payload?.reasons?.[0] || ""));
      return [];
    });

    const next = vi.fn();
    await runtime.middleware(
      {
        get: () => "",
        method: "GET",
        path: "/sobre",
        query: {},
      },
      {},
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(enqueueCalls).toContain("missing-client-asset:/sobre");
  });
});
