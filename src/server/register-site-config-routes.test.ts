import { describe, expect, it, vi } from "vitest";

import { registerSiteConfigRoutes } from "../../server/routes/register-site-config-routes.js";

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
      post: register("POST"),
      put: register("PUT"),
    },
    routes,
  };
};

const getRoute = (routes, method, path) =>
  routes.find((route) => route.method === method && route.path === path);

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const createDependencies = ({ app, overrides = {} }) => {
  const requireAuth = vi.fn((_req, _res, next) => next?.());

  return {
    app,
    ANILIST_API: "https://graphql.anilist.co",
    appendAuditLog: vi.fn(),
    buildPublicMediaVariants: vi.fn(() => ({})),
    canManageIntegrations: vi.fn(() => true),
    canManagePages: vi.fn(() => true),
    canManageSettings: vi.fn(() => true),
    collectDownloadIconUploads: vi.fn(() => new Set()),
    createRevisionToken: vi.fn(() => "rev-123"),
    deletePrivateUploadByUrl: vi.fn(),
    enqueueProjectOgPrewarm: vi.fn(() => Promise.resolve()),
    ensureNoEditConflict: vi.fn(() => true),
    loadPages: vi.fn(() => ({ about: { title: "Sobre" } })),
    loadSiteSettings: vi.fn(() => ({ site: { name: "Nekomata" } })),
    loadTagTranslations: vi.fn(() => ({
      tags: { Action: "A\u00e7\u00e3o" },
      genres: { Drama: "Drama" },
      staffRoles: { Writer: "Roteiro" },
    })),
    normalizeSiteSettings: vi.fn((value) => value),
    parseEditRevisionOptions: vi.fn(() => ({})),
    requireAuth,
    writePages: vi.fn(),
    writeSiteSettings: vi.fn(),
    writeTagTranslations: vi.fn(),
    ...overrides,
  };
};

describe("registerSiteConfigRoutes", () => {
  it("registra GET /api/public/tag-translations e retorna revision", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({ app });

    registerSiteConfigRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/public/tag-translations");
    expect(route).toBeDefined();

    const res = createMockRes();
    await route.handlers[route.handlers.length - 1]({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      tags: { Action: "A\u00e7\u00e3o" },
      genres: { Drama: "Drama" },
      staffRoles: { Writer: "Roteiro" },
      revision: "rev-123",
    });
    expect(dependencies.loadTagTranslations).toHaveBeenCalledTimes(1);
    expect(dependencies.createRevisionToken).toHaveBeenCalledWith({
      tags: { Action: "A\u00e7\u00e3o" },
      genres: { Drama: "Drama" },
      staffRoles: { Writer: "Roteiro" },
    });
  });
});
