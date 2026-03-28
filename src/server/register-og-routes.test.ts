import { describe, expect, it, vi } from "vitest";

import { registerOgRoutes } from "../../server/routes/register-og-routes.js";

const createAppRecorder = () => {
  const routes = [];
  const register = (method) => (path, ...handlers) => {
    routes.push({
      method,
      path,
      handlers,
    });
  };

  return {
    app: {
      get: register("GET"),
    },
    routes,
  };
};

const getRoute = (routes, method, path) =>
  routes.find((route) => route.method === method && route.path === path);

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  contentType: "",
  status(code) {
    this.statusCode = code;
    return this;
  },
  type(value) {
    this.contentType = value;
    return this;
  },
  setHeader(key, value) {
    this.headers[key] = value;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
});

const projectFixture = {
  id: "project-1",
  title: "Projeto 1",
};

const postFixture = {
  id: "post-1",
  slug: "post-teste",
  title: "Post Teste",
  publishedAt: "2024-01-01T00:00:00.000Z",
  status: "published",
  projectId: "",
  content: "<p>Conteudo</p>",
  contentFormat: "html",
};

const createDependencies = ({ app, overrides = {} }) => ({
  app,
  PRIMARY_APP_ORIGIN: "https://nekomata.moe",
  resolveInstitutionalOgPageTitle: vi.fn((pageKey) => (pageKey === "about" ? "Sobre" : "")),
  loadSiteSettings: vi.fn(() => ({ site: { defaultShareImage: "/share.png" } })),
  loadPages: vi.fn(() => []),
  loadTagTranslations: vi.fn(() => ({ tags: {}, genres: {} })),
  getPublicVisibleProjects: vi.fn(() => [projectFixture]),
  ogRenderCache: {},
  resolveMetaImageVariantUrl: vi.fn((value) => value),
  getInstitutionalOgCachedRender: vi.fn(async () => ({
    buffer: Buffer.from("institutional"),
    contentType: "image/jpeg",
    cacheHit: false,
    timings: { total: 10 },
  })),
  buildInstitutionalOgDeliveryHeaders: vi.fn(() => ({
    cache: "miss",
    serverTiming: "total;dur=10",
  })),
  getProjectReadingOgCachedRender: vi.fn(async () => ({
    buffer: Buffer.from("reading"),
    contentType: "image/jpeg",
    cacheHit: true,
    timings: { total: 9 },
  })),
  buildProjectReadingOgDeliveryHeaders: vi.fn(() => ({
    cache: "hit",
    serverTiming: "total;dur=9",
  })),
  getProjectOgCachedRender: vi.fn(async () => ({
    buffer: Buffer.from("project"),
    contentType: "image/jpeg",
    cacheHit: true,
    timings: { total: 8 },
  })),
  buildProjectOgDeliveryHeaders: vi.fn(() => ({
    cache: "hit",
    serverTiming: "total;dur=8",
  })),
  logProjectOgDelivery: vi.fn(),
  normalizePosts: vi.fn((posts) => posts),
  loadPosts: vi.fn(() => [postFixture]),
  resolvePostCover: vi.fn(() => ({
    coverImageUrl: "/uploads/post-cover.jpg",
    coverAlt: "Capa",
    source: "manual",
  })),
  extractFirstImageFromPostContent: vi.fn(() => ({
    coverImageUrl: "/uploads/body.jpg",
    coverAlt: "Body",
  })),
  resolveEditorialAuthorFromPost: vi.fn(() => ({
    name: "Autora",
    avatarUrl: "https://cdn.example.com/avatar.png",
  })),
  getPostOgCachedRender: vi.fn(async () => ({
    buffer: Buffer.from("post"),
    contentType: "image/png",
    cacheHit: false,
    timings: { total: 7 },
  })),
  ...overrides,
});

describe("registerOgRoutes", () => {
  it("returns 404 text when the institutional page key is invalid", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        resolveInstitutionalOgPageTitle: vi.fn(() => ""),
      },
    });

    registerOgRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/og/institutional/:pageKey");
    const res = createMockRes();
    await route.handlers[route.handlers.length - 1]({ params: { pageKey: "missing" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.contentType).toBe("text/plain");
    expect(res.body).toBe("not_found");
    expect(dependencies.getInstitutionalOgCachedRender).not.toHaveBeenCalled();
  });

  it("applies diagnostic headers for the project OG endpoint", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({ app });

    registerOgRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/og/project/:id");
    const res = createMockRes();
    await route.handlers[route.handlers.length - 1](
      {
        params: { id: "project-1" },
        headers: { "user-agent": "Vitest" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/jpeg");
    expect(res.headers["Cache-Control"]).toBe("public, max-age=300, stale-while-revalidate=86400");
    expect(res.headers["X-OG-Cache"]).toBe("hit");
    expect(res.headers["Server-Timing"]).toBe("total;dur=8");
    expect(Buffer.from(res.body).toString()).toBe("project");
    expect(dependencies.logProjectOgDelivery).toHaveBeenCalledWith({
      projectId: "project-1",
      cacheHit: true,
      timings: { total: 8 },
      userAgent: "Vitest",
    });
  });

  it("keeps the post OG response without diagnostic cache headers", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({ app });

    registerOgRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/og/post/:slug");
    const res = createMockRes();
    await route.handlers[route.handlers.length - 1](
      {
        params: { slug: "post-teste" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["Cache-Control"]).toBe("public, max-age=300, stale-while-revalidate=86400");
    expect(res.headers["X-OG-Cache"]).toBeUndefined();
    expect(res.headers["Server-Timing"]).toBeUndefined();
    expect(Buffer.from(res.body).toString()).toBe("post");
    expect(dependencies.getPostOgCachedRender).toHaveBeenCalledTimes(1);
  });
});
