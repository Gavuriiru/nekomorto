import { describe, expect, it, vi } from "vitest";

import {
  LEGACY_PUBLIC_ANALYTICS_INGEST_PATH,
  PUBLIC_ANALYTICS_INGEST_PATH,
} from "../../shared/public-analytics.js";
import { registerPublicRoutes } from "../../server/routes/register-public-routes.js";

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
  statusCode: 200,
  body: null as any,
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
  app,
  PUBLIC_ANALYTICS_EVENT_TYPE_SET: new Set(["chapter_view", "download_click"]),
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET: new Set(["chapter", "pwa"]),
  appendAnalyticsEvent: vi.fn(() => ({ ok: true })),
  canRegisterView: vi.fn(async () => true),
  getRequestIp: vi.fn((req) => String(req?.ip || "").trim()),
  ...overrides,
});

const buildRequest = (body = {}) => ({
  body,
  headers: { "x-forwarded-for": "198.51.100.99" },
  ip: "127.0.0.1",
});

describe("registerPublicRoutes", () => {
  it("registers both the public engagement endpoint and the legacy analytics alias", () => {
    const { app, routes } = createAppRecorder();

    registerPublicRoutes(createDependencies({ app }));

    expect(getRoute(routes, "POST", PUBLIC_ANALYTICS_INGEST_PATH)).toBeDefined();
    expect(getRoute(routes, "POST", LEGACY_PUBLIC_ANALYTICS_INGEST_PATH)).toBeDefined();
  });

  it.each([
    PUBLIC_ANALYTICS_INGEST_PATH,
    LEGACY_PUBLIC_ANALYTICS_INGEST_PATH,
  ])("accepts valid public analytics ingestion payloads on %s", async (path) => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({ app });

    registerPublicRoutes(dependencies);

    const route = getRoute(routes, "POST", path);
    const req = buildRequest({
      eventType: "chapter_view",
      resourceType: "chapter",
      resourceId: "project-1:1:2",
      meta: {
        projectId: "project-1",
        chapterNumber: 1,
        volume: 2,
      },
    });
    const res = await invokeFinalHandler(route, req);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, deduped: false });
    expect(dependencies.canRegisterView).toHaveBeenCalledWith("127.0.0.1");
    expect(dependencies.appendAnalyticsEvent).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        eventType: "chapter_view",
        resourceType: "chapter",
        resourceId: "project-1:1:2",
        meta: expect.objectContaining({
          projectId: "project-1",
          chapterNumber: 1,
          volume: 2,
        }),
      }),
    );
  });

  it.each([
    PUBLIC_ANALYTICS_INGEST_PATH,
    LEGACY_PUBLIC_ANALYTICS_INGEST_PATH,
  ])("returns 400 for invalid event types on %s", async (path) => {
    const { app, routes } = createAppRecorder();

    registerPublicRoutes(createDependencies({ app }));

    const route = getRoute(routes, "POST", path);
    const res = await invokeFinalHandler(
      route,
      buildRequest({
        eventType: "invalid",
        resourceType: "chapter",
        resourceId: "project-1:1:2",
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid_event_type" });
  });

  it.each([
    PUBLIC_ANALYTICS_INGEST_PATH,
    LEGACY_PUBLIC_ANALYTICS_INGEST_PATH,
  ])("returns 429 when public analytics ingestion is rate limited on %s", async (path) => {
    const { app, routes } = createAppRecorder();

    registerPublicRoutes(
      createDependencies({
        app,
        overrides: {
          canRegisterView: vi.fn(async () => false),
        },
      }),
    );

    const route = getRoute(routes, "POST", path);
    const res = await invokeFinalHandler(
      route,
      buildRequest({
        eventType: "chapter_view",
        resourceType: "chapter",
        resourceId: "project-1:1:2",
      }),
    );

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
  });

  it.each([
    PUBLIC_ANALYTICS_INGEST_PATH,
    LEGACY_PUBLIC_ANALYTICS_INGEST_PATH,
  ])("returns 500 when analytics event persistence fails on %s", async (path) => {
    const { app, routes } = createAppRecorder();

    registerPublicRoutes(
      createDependencies({
        app,
        overrides: {
          appendAnalyticsEvent: vi.fn(() => ({ ok: false, reason: "write_failed" })),
        },
      }),
    );

    const route = getRoute(routes, "POST", path);
    const res = await invokeFinalHandler(
      route,
      buildRequest({
        eventType: "chapter_view",
        resourceType: "chapter",
        resourceId: "project-1:1:2",
      }),
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "event_write_failed" });
  });
});
