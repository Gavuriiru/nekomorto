import { describe, expect, it } from "vitest";

import {
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  createPublicSiteRuntime,
} from "../../server/lib/public-site-runtime.js";

const createDeps = (overrides = {}) => ({
  bootstrapPwaEnabled: true,
  buildPublicBootstrapPayload: (payload) => ({ ...payload }),
  buildPublicMediaVariants: () => ({ variants: true }),
  buildPublicTeamMembers: () => [{ id: "team-1", avatarUrl: "/uploads/team-1.png" }],
  buildUserPayload: (user) => ({ ...user, built: true }),
  createGuid: () => "uuid-1",
  createSlug: (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-"),
  extractLocalStylesheetHrefs: () => ["/assets/app.css"],
  getPublicVisiblePosts: () => [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello",
      excerpt: "Resumo",
      content: "<p>Conteudo</p>",
      author: "Equipe",
      publishedAt: "2026-03-28T10:00:00.000Z",
      tags: ["noticia"],
      coverImageUrl: "/uploads/post.jpg",
    },
  ],
  getPublicVisibleProjects: () => [
    {
      id: "project-1",
      title: "Projeto",
      cover: "/uploads/project-cover.jpg",
      banner: "/uploads/project-banner.jpg",
      heroImageUrl: "/uploads/project-hero.jpg",
      forceHero: true,
      updatedAt: "2026-03-28T11:00:00.000Z",
      episodeDownloads: [{ number: 5, volume: 1, coverImageUrl: "/uploads/chapter-5.jpg" }],
      volumeEntries: [{ volume: 1, coverImageUrl: "/uploads/volume-1.jpg" }],
      volumeCovers: [{ volume: 1, coverImageUrl: "/uploads/volume-cover-1.jpg" }],
    },
  ],
  getPublicVisibleUpdates: () => [
    {
      id: "update-1",
      projectId: "project-1",
      projectTitle: "Projeto",
      kind: "Lançamento",
      reason: "Capitulo novo",
      updatedAt: "2026-03-28T12:00:00.000Z",
      episodeNumber: 5,
      volume: 1,
      unit: "Capítulo",
    },
  ],
  injectBootstrapGlobals: ({ html, publicBootstrap, publicMe, pwaEnabled, skipPublicFetch }) =>
    `${html}|bootstrap:${publicBootstrap ? "yes" : "no"}|me:${publicMe ? "yes" : "no"}|pwa:${pwaEnabled ? "yes" : "no"}|skip:${skipPublicFetch ? "yes" : "no"}`,
  injectHomeHeroShell: ({ html, shellMarkup }) => `${html}|shell:${shellMarkup ? "yes" : "no"}`,
  injectPreloadLinks: ({ html, preloads }) => `${html}|preloads:${preloads.length}`,
  loadLinkTypes: () => [{ id: "site", label: "Site" }],
  loadPages: () => ({ home: { shareImage: "/uploads/home.jpg", shareImageAlt: "Home" } }),
  loadSiteSettings: () => ({ updatedAt: "2026-03-28T09:00:00.000Z", site: { defaultShareImage: "/uploads/default-og.jpg" } }),
  loadTagTranslations: () => ({ tags: {}, genres: {}, staffRoles: {} }),
  primaryAppOrigin: "https://example.com",
  resolveHomeHeroPreloadFromSlide: ({ imageUrl }) =>
    imageUrl
      ? { href: imageUrl, imagesrcset: `${imageUrl} 1x`, imagesizes: "100vw" }
      : null,
  resolveMetaImageVariantUrl: (value) => value,
  resolvePostCover: (post) => ({
    coverImageUrl: post.coverImageUrl || "",
    coverAlt: "cover-alt",
  }),
  resolvePublicPostCoverPreload: ({ coverUrl }) => (coverUrl ? { href: coverUrl, as: "image" } : null),
  resolvePublicProjectsListPreloads: ({ projects }) =>
    Array.isArray(projects) && projects.length ? [{ href: "/uploads/project-hero.jpg", as: "image" }] : [],
  resolvePublicReaderHeroPreload: ({ imageUrl }) => (imageUrl ? { href: imageUrl, as: "image" } : null),
  resolveBootstrapPwaEnabled: undefined,
  resolvePublicTeamAvatarPreload: ({ teamMembers }) =>
    Array.isArray(teamMembers) && teamMembers.length ? { href: "/uploads/team-1.png", as: "image" } : null,
  sitemapStaticPublicPaths: ["/", "/projetos"],
  stripHtml: (value) => String(value || "").replace(/<[^>]+>/g, ""),
  ...overrides,
});

describe("public-site-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createPublicSiteRuntime()).toThrow(/missing required dependencies/i);
  });

  it("builds sitemap and RSS items from public visibility inputs", () => {
    const runtime = createPublicSiteRuntime(createDeps());

    expect(runtime.buildPublicSitemapEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loc: "https://example.com/" }),
        expect.objectContaining({ loc: "https://example.com/projeto/project-1" }),
        expect.objectContaining({ loc: "https://example.com/postagem/hello-world" }),
      ]),
    );
    expect(runtime.buildPostsRssItems()).toEqual([
      expect.objectContaining({
        link: "https://example.com/postagem/hello-world",
      }),
    ]);
    expect(runtime.buildLaunchesRssItems()).toEqual([
      expect.objectContaining({
        guid: "https://example.com/projeto/project-1#update-update-1",
      }),
    ]);
  });

  it("builds public bootstrap payloads and injects bootstrap HTML", () => {
    const runtime = createPublicSiteRuntime(createDeps());

    const fullPayload = runtime.buildPublicBootstrapResponsePayload({
      payloadMode: PUBLIC_BOOTSTRAP_MODE_FULL,
    });
    const criticalPayload = runtime.buildPublicBootstrapResponsePayload({
      payloadMode: PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
    });

    expect(fullPayload.payloadMode).toBe("full");
    expect(fullPayload.mediaVariants).toEqual({ variants: true });
    expect(criticalPayload.payloadMode).toBe("critical-home");
    expect(Array.isArray(criticalPayload.projects)).toBe(true);

    const publicHtml = runtime.injectPublicBootstrapHtml({
      html: "<html></html>",
      req: {
        path: "/",
        session: { user: { id: "user-1" } },
      },
      settings: {},
      pages: {},
      includeHeroImagePreload: true,
      includeProjectsImagePreloads: true,
      includeHomeHeroShell: true,
      bootstrapMode: PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
    });
    const dashboardHtml = runtime.injectDashboardBootstrapHtml({
      html: "<html></html>",
      req: {
        session: { user: { id: "user-1" } },
      },
      settings: {},
    });

    expect(publicHtml).toContain("bootstrap:yes");
    expect(publicHtml).toContain("pwa:yes");
    expect(publicHtml).toContain("preloads:");
    expect(publicHtml).toContain("shell:yes");
    expect(dashboardHtml).toContain("bootstrap:no");
    expect(dashboardHtml).toContain("pwa:yes");
    expect(dashboardHtml).toContain("skip:yes");
  });

  it("resolves the bootstrap pwa flag per request when a resolver is provided", () => {
    const runtime = createPublicSiteRuntime(
      createDeps({
        bootstrapPwaEnabled: undefined,
        resolveBootstrapPwaEnabled: (req) => String(req?.hostname || "") === "localhost",
      }),
    );

    const publicHtml = runtime.injectPublicBootstrapHtml({
      html: "<html></html>",
      req: {
        hostname: "dev.nekomata.moe",
        path: "/",
      },
      settings: {},
      pages: {},
    });
    const dashboardHtml = runtime.injectDashboardBootstrapHtml({
      html: "<html></html>",
      req: {
        hostname: "localhost",
      },
      settings: {},
    });

    expect(publicHtml).toContain("pwa:no");
    expect(dashboardHtml).toContain("pwa:yes");
  });
});
