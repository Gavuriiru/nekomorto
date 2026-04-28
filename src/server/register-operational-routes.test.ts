import { describe, expect, it, vi } from "vitest";

import { registerOperationalRoutes } from "../../server/lib/register-operational-routes.js";

const createRouterCapture = () => {
  let router = null;
  const app = {
    use: vi.fn((value) => {
      router = value;
    }),
  };

  return {
    app,
    getRouter: () => router,
  };
};

const getRoute = (router, method, path) =>
  router?.stack?.find(
    (layer) =>
      layer?.route?.path === path &&
      Boolean(layer?.route?.methods?.[String(method || "").toLowerCase()]),
  ) || null;

const createMockRes = () => ({
  statusCode: 200,
  body: undefined,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
});

const invokeRoute = async (routeLayer, req = {}) => {
  const res = createMockRes();
  const stack = Array.isArray(routeLayer?.route?.stack) ? routeLayer.route.stack : [];
  let index = 0;
  const next = async () => {
    const layer = stack[index];
    index += 1;
    if (!layer?.handle) {
      return;
    }
    await layer.handle(req, res, next);
  };
  await next();
  expect(res.body).toBeDefined();
  return { ...res, body: res.body as any };
};

const createDependencies = (overrides = {}) => ({
  app: createRouterCapture().app,
  buildRuntimeMetadata: () => ({ apiVersion: "v1", commitSha: "abc123", builtAt: "2026-04-28" }),
  evaluateOperationalMonitoring: vi.fn(async () => ({
    health: {
      ok: true,
      status: "ok",
      ts: "2026-04-28T20:15:18.238Z",
      dataSource: "db",
      maintenanceMode: false,
      checks: [
        {
          name: "uploads_dir",
          status: "ok",
          latencyMs: 3.8,
          message: "Diretório de uploads acessível.",
          meta: { path: "D:\\dev\\nekomorto\\public\\uploads" },
        },
      ],
      summary: { total: 1, ok: 1, warning: 0, critical: 0 },
    },
  })),
  isMetricsEnabled: true,
  loadSecurityEvents: () => [],
  loadUserSessionIndexRecords: () => [],
  metricsRegistry: {
    setGauge: vi.fn(),
    renderPrometheus: vi.fn(() => ""),
  },
  metricsTokenNormalized: "metrics-token",
  operationalHealthTokenNormalized: "health-token",
  securityEventStatusOpen: "open",
  ...overrides,
});

const registerWithCapture = (overrides = {}) => {
  const capture = createRouterCapture();
  const dependencies = createDependencies({ app: capture.app, ...overrides });
  registerOperationalRoutes(dependencies);
  return { ...capture, dependencies };
};

describe("registerOperationalRoutes", () => {
  it("sanitizes public health payloads while preserving compatibility fields", async () => {
    const { getRouter } = registerWithCapture();
    const route = getRoute(getRouter(), "GET", "/api/health");

    const response = await invokeRoute(route, {
      ip: "203.0.113.10",
      headers: {},
      socket: { remoteAddress: "203.0.113.10" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      status: "ok",
      ts: "2026-04-28T20:15:18.238Z",
      dataSource: "db",
      maintenanceMode: false,
      checks: [{ name: "uploads_dir", status: "ok", latencyMs: 4 }],
      summary: { total: 1, ok: 1, warning: 0, critical: 0 },
      build: { apiVersion: "v1" },
    });
  });

  it("returns detailed health payloads for direct loopback requests", async () => {
    const { getRouter } = registerWithCapture();
    const route = getRoute(getRouter(), "GET", "/api/health/ready");

    const response = await invokeRoute(route, {
      headers: {},
      socket: { remoteAddress: "127.0.0.42" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.checks[0]).toEqual({
      name: "uploads_dir",
      status: "ok",
      latencyMs: 3.8,
      message: "Diretório de uploads acessível.",
      meta: { path: "D:\\dev\\nekomorto\\public\\uploads" },
    });
    expect(response.body.build).toEqual({
      apiVersion: "v1",
      commitSha: "abc123",
      builtAt: "2026-04-28",
    });
  });

  it("does not trust public traffic forwarded through loopback as internal", async () => {
    const { getRouter } = registerWithCapture();
    const route = getRoute(getRouter(), "GET", "/api/health");

    const response = await invokeRoute(route, {
      headers: { "x-forwarded-for": "203.0.113.10" },
      socket: { remoteAddress: "127.0.0.1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.checks[0]).toEqual({ name: "uploads_dir", status: "ok", latencyMs: 4 });
    expect(response.body.build).toEqual({ apiVersion: "v1" });
  });

  it("returns detailed health payloads for valid operational tokens", async () => {
    const { getRouter } = registerWithCapture();
    const route = getRoute(getRouter(), "GET", "/api/health");

    const response = await invokeRoute(route, {
      ip: "203.0.113.10",
      headers: { authorization: "Bearer health-token" },
      socket: { remoteAddress: "203.0.113.10" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.checks[0].meta).toEqual({ path: "D:\\dev\\nekomorto\\public\\uploads" });
    expect(response.body.build.commitSha).toBe("abc123");
  });

  it("keeps fail status mapped to 503", async () => {
    const { getRouter } = registerWithCapture({
      evaluateOperationalMonitoring: vi.fn(async () => ({
        health: {
          ok: false,
          status: "fail",
          ts: "2026-04-28T20:15:18.238Z",
          dataSource: "db",
          maintenanceMode: false,
          checks: [{ name: "database", status: "critical", message: "db failed" }],
          summary: { total: 1, ok: 0, warning: 0, critical: 1 },
        },
      })),
    });
    const route = getRoute(getRouter(), "GET", "/api/health");

    const response = await invokeRoute(route, {
      ip: "203.0.113.10",
      headers: {},
      socket: { remoteAddress: "203.0.113.10" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body.checks).toEqual([{ name: "database", status: "critical" }]);
  });
});
