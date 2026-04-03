import { describe, expect, it, vi } from "vitest";

import { registerPublicProjectRoutes } from "../../server/routes/public/register-public-project-routes.js";

const createAppRecorder = () => {
  const routes: Array<{
    method: string;
    path: string;
    handlers: Array<(...args: any[]) => unknown>;
  }> = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: Array<(...args: any[]) => unknown>) => {
      routes.push({
        method,
        path,
        handlers,
      });
    };

  return {
    app: {
      get: register("GET"),
      post: register("POST"),
    },
    routes,
  };
};

const getRoute = (routes, method, path) =>
  routes.find((route) => route.method === method && route.path === path);

const createMockRes = () => ({
  body: null as any,
  headers: {},
  statusCode: 200,
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const invokeFinalHandler = async (route, req) => {
  const res = createMockRes();
  await route.handlers[route.handlers.length - 1](req, res);
  return res;
};

const createDependencies = ({ app, overrides = {} }) => ({
  PRIMARY_APP_ORIGIN: "https://nekomata.moe",
  PUBLIC_READ_CACHE_TAGS: { PROJECTS: "projects" },
  PUBLIC_READ_CACHE_TTL_MS: 60_000,
  app,
  appendAnalyticsEvent: vi.fn(),
  buildProjectOgRevision: vi.fn(() => "project-revision"),
  buildPublicMediaVariants: vi.fn(() => ({ cover: "variant" })),
  canRegisterPollVote: vi.fn(async () => true),
  canRegisterView: vi.fn(async () => true),
  deriveChapterSynopsis: vi.fn((chapter) => String(chapter?.synopsis || "")),
  getProjectEpisodePageCount: vi.fn(({ content, pages }) =>
    Array.isArray(pages) && pages.length > 0 ? pages.length : content ? 1 : 0,
  ),
  getPublicReadableProjects: vi.fn(() => []),
  getPublicVisibleProjects: vi.fn(() => []),
  hasProjectEpisodePages: vi.fn(({ pages }) => Array.isArray(pages) && pages.length > 0),
  incrementProjectViews: vi.fn(() => ({ views: 1 })),
  loadProjects: vi.fn(() => []),
  loadSiteSettings: vi.fn(() => ({ reader: { mode: "default" } })),
  loadTagTranslations: vi.fn(() => ({ tags: {}, genres: {} })),
  normalizeProjectEpisodeContentFormat: vi.fn((value, fallback = "lexical") => value || fallback),
  normalizeProjectEpisodePages: vi.fn((pages) => (Array.isArray(pages) ? pages : [])),
  normalizeProjects: vi.fn((projects) => projects),
  readPublicCachedJson: vi.fn(() => null),
  resolveMetaImageVariantUrl: vi.fn((value) => value),
  resolveProjectReaderConfig: vi.fn(() => ({ mode: "paged" })),
  updateLexicalPollVotes: vi.fn(() => ({ updated: false, content: null })),
  writeProjects: vi.fn(),
  writePublicCachedJson: vi.fn(),
  ...overrides,
});

describe("registerPublicProjectRoutes", () => {
  it("returns volume_required for ambiguous published chapters on the public reader route", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        getPublicReadableProjects: vi.fn(() => [
          {
            id: "project-1",
            episodeDownloads: [
              { number: 5, volume: 1, publicationStatus: "published" },
              { number: 5, volume: 2, publicationStatus: "published" },
            ],
          },
        ]),
      },
    });

    registerPublicProjectRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/public/projects/:id/chapters/:number");
    const res = await invokeFinalHandler(route, {
      params: { id: "project-1", number: "5" },
      query: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "volume_required" });
  });

  it("serializes chapter payloads with reader config when a specific published volume is requested", async () => {
    const { app, routes } = createAppRecorder();
    const chapter = {
      number: 5,
      volume: 2,
      title: "Capitulo 5",
      synopsis: "Resumo",
      publicationStatus: "published",
      contentFormat: "images",
      pages: [
        {
          imageUrl: "https://cdn.example.com/p-1.jpg",
        },
      ],
      coverImageAlt: "Capa do capitulo",
      releaseDate: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    };
    const dependencies = createDependencies({
      app,
      overrides: {
        getPublicReadableProjects: vi.fn(() => [
          {
            id: "project-1",
            type: "manga",
            readerConfig: { mode: "longstrip" },
            episodeDownloads: [chapter],
          },
        ]),
      },
    });

    registerPublicProjectRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/public/projects/:id/chapters/:number");
    const res = await invokeFinalHandler(route, {
      params: { id: "project-1", number: "5" },
      query: { volume: "2" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      chapter: {
        number: 5,
        volume: 2,
        title: "Capitulo 5",
        entryKind: "main",
        entrySubtype: "",
        readingOrder: undefined,
        displayLabel: "",
        synopsis: "Resumo",
        releaseDate: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
        coverImageUrl: "https://cdn.example.com/p-1.jpg",
        coverImageAlt: "Capa do capitulo",
        content: "",
        contentFormat: "images",
        pages: [
          {
            imageUrl: "https://cdn.example.com/p-1.jpg",
          },
        ],
        pageCount: 1,
        hasPages: true,
      },
      readerConfig: {
        mode: "paged",
      },
    });
  });

  it("reuses the same published chapter lookup for poll voting and blocks ambiguous requests", async () => {
    const { app, routes } = createAppRecorder();
    const project = {
      id: "project-1",
      episodeDownloads: [
        { number: 9, volume: 1, publicationStatus: "published", content: "{}" },
        { number: 9, volume: 2, publicationStatus: "published", content: "{}" },
      ],
    };
    const dependencies = createDependencies({
      app,
      overrides: {
        loadProjects: vi.fn(() => [project]),
        normalizeProjects: vi.fn((projects) => projects),
      },
    });

    registerPublicProjectRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/projects/:id/chapters/:number/polls/vote");
    const res = await invokeFinalHandler(route, {
      body: {
        optionUid: "option-1",
        voterId: "reader-1",
      },
      headers: {},
      ip: "127.0.0.1",
      params: { id: "project-1", number: "9" },
      query: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "volume_required" });
    expect(dependencies.updateLexicalPollVotes).not.toHaveBeenCalled();
    expect(dependencies.writeProjects).not.toHaveBeenCalled();
  });

  it("keeps project detail payloads free of discordRoleId while preserving revision and media variants", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        getPublicVisibleProjects: vi.fn(() => [
          {
            id: "project-1",
            title: "Projeto",
            type: "manga",
            discordRoleId: "discord-role-1",
            readerConfig: { mode: "longstrip" },
          },
        ]),
      },
    });

    registerPublicProjectRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/public/projects/:id");
    const res = await invokeFinalHandler(route, {
      params: { id: "project-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      project: {
        id: "project-1",
        title: "Projeto",
        type: "manga",
        readerConfig: {
          mode: "paged",
        },
      },
      revision: "project-revision",
      mediaVariants: {
        cover: "variant",
      },
    });
    expect(res.body.project).not.toHaveProperty("discordRoleId");
  });
});
