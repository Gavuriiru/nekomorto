import { describe, expect, it, vi } from "vitest";

import { registerSelfServiceRoutes } from "../../server/lib/register-self-service-routes.js";

const createAppCapture = () => {
  const routers: any[] = [];
  return {
    app: {
      use: (router: unknown) => {
        routers.push(router);
      },
    },
    getRouter: () => routers[0],
  };
};

const getRouteLayer = (router: any, method: string, path: string) =>
  router?.stack?.find(
    (layer: any) =>
      layer?.route?.path === path && Boolean(layer.route.methods?.[String(method || "").toLowerCase()]),
  ) || null;

const createResponse = () => ({
  body: null as unknown,
  headers: new Map<string, string>(),
  statusCode: 200,
  json(payload: unknown) {
    this.body = payload;
    return this;
  },
  setHeader(name: string, value: unknown) {
    this.headers.set(String(name).toLowerCase(), String(value));
    return this;
  },
  status(code: number) {
    this.statusCode = Number(code);
    return this;
  },
});

const invokeRoute = async (routeLayer: any, req: Record<string, unknown>) => {
  const res = createResponse();
  const handlers = Array.isArray(routeLayer?.route?.stack)
    ? routeLayer.route.stack.map((entry: any) => entry.handle)
    : [];
  let index = 0;
  const next = async () => {
    const handler = handlers[index];
    index += 1;
    if (!handler) {
      return;
    }
    return handler(req, res, next);
  };
  await next();
  return res;
};

const createDependencies = (overrides: Record<string, unknown> = {}) => {
  const { app, getRouter } = createAppCapture();
  const appendAuditLog = vi.fn();
  const metricsRegistry = { inc: vi.fn() };
  const requireAuth = vi.fn((_req, _res, next) => next?.());

  registerSelfServiceRoutes({
    app,
    appendAuditLog,
    buildMySecuritySummary: vi.fn(() => ({})),
    canManageMfa: vi.fn(async () => true),
    clearEnrollmentFromSession: vi.fn(),
    dataEncryptionKeyring: { activeKeyId: "key-1" },
    deleteUserMfaTotpRecord: vi.fn(),
    encryptStringWithKeyring: vi.fn(() => "encrypted"),
    generateRecoveryCodes: vi.fn(() => ["code-1"]),
    getRequestIp: vi.fn(() => "198.51.100.40"),
    handleMfaFailureSecuritySignals: vi.fn(),
    hashRecoveryCode: vi.fn(({ code }) => `hash:${code}`),
    isPlainObject: vi.fn((value) => value && typeof value === "object" && !Array.isArray(value)),
    isTotpEnabledForUser: vi.fn(() => true),
    listActiveSessionsForUser: vi.fn(() => []),
    metricsRegistry,
    mfaRecoveryCodePepper: "pepper",
    normalizeUserPreferences: vi.fn((value) => value || {}),
    requireAuth,
    resolveEnrollmentFromSession: vi.fn(() => ({
      secret: "secret",
    })),
    resolveMfaMetadata: vi.fn(() => ({
      accountLabel: "user-1",
      iconUrl: "",
      issuer: "Nekomata",
    })),
    revokeSessionBySid: vi.fn(async () => undefined),
    saveSessionState: vi.fn(async () => undefined),
    startTotpEnrollment: vi.fn(() => null),
    verifyTotpCode: vi.fn(() => true),
    verifyTotpOrRecoveryCode: vi.fn(() => ({ method: "totp", ok: true })),
    userPreferencesMaxBytes: 1024,
    loadUserPreferences: vi.fn(() => ({})),
    writeUserMfaTotpRecord: vi.fn(),
    writeUserPreferences: vi.fn((userId, value) => ({ userId, ...value })),
    ...overrides,
  });

  return {
    appendAuditLog,
    metricsRegistry,
    requireAuth,
    router: getRouter(),
    ...overrides,
  };
};

describe("registerSelfServiceRoutes", () => {
  it("rate limits TOTP enrollment confirmation before verifying the code", async () => {
    const canManageMfa = vi.fn(async () => false);
    const verifyTotpCode = vi.fn();
    const dependencies = createDependencies({
      canManageMfa,
      verifyTotpCode,
    });
    const routeLayer = getRouteLayer(dependencies.router, "post", "/api/me/security/totp/enroll/confirm");

    const res = await invokeRoute(routeLayer, {
      body: {
        code: "123456",
        enrollmentToken: "token-1",
      },
      session: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(canManageMfa).toHaveBeenCalledWith("198.51.100.40");
    expect(verifyTotpCode).not.toHaveBeenCalled();
    expect(dependencies.metricsRegistry.inc).toHaveBeenCalledWith("auth_mfa_verify_total", {
      status: "rate_limited",
    });
  });

  it("rate limits TOTP disable before consuming recovery codes", async () => {
    const canManageMfa = vi.fn(async () => false);
    const verifyTotpOrRecoveryCode = vi.fn();
    const dependencies = createDependencies({
      canManageMfa,
      verifyTotpOrRecoveryCode,
    });
    const routeLayer = getRouteLayer(dependencies.router, "post", "/api/me/security/totp/disable");

    const res = await invokeRoute(routeLayer, {
      body: {
        codeOrRecoveryCode: "123456",
      },
      session: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(canManageMfa).toHaveBeenCalledWith("198.51.100.40");
    expect(verifyTotpOrRecoveryCode).not.toHaveBeenCalled();
  });
});
