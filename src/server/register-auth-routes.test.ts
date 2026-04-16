import { describe, expect, it, vi } from "vitest";

import { registerAuthRoutes } from "../../server/lib/register-auth-routes.js";

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
  clearedCookies: [] as Array<{ name: string; options: Record<string, unknown> }>,
  headers: new Map<string, string>(),
  locals: {} as Record<string, unknown>,
  nextArgs: [] as unknown[],
  redirectUrl: "",
  statusCode: 200,
  clearCookie(name: string, options: Record<string, unknown>) {
    this.clearedCookies.push({ name, options });
    return this;
  },
  json(payload: unknown) {
    this.body = payload;
    return this;
  },
  redirect(target: string) {
    this.redirectUrl = target;
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

const invokeHandlers = async (handlers: Array<(...args: any[]) => unknown>, req: Record<string, unknown>) => {
  const res = createResponse();
  let index = 0;
  const runHandler = async (arg?: unknown) => {
    if (arg !== undefined) {
      res.nextArgs.push(arg);
    }
    if (arg === "route" || arg === "router") {
      return;
    }
    const handler = handlers[index];
    index += 1;
    if (!handler) {
      return;
    }
    return handler(req, res, next);
  };
  const next = async (arg?: unknown) => runHandler(arg);
  await runHandler();
  return res;
};

const invokeRoute = async (routeLayer: any, req: Record<string, unknown>) => {
  const handlers = Array.isArray(routeLayer?.route?.stack)
    ? routeLayer.route.stack.map((entry: any) => entry.handle)
    : [];
  return invokeHandlers(handlers, req);
};

const getRouteHandlerNames = (routeLayer: any) =>
  Array.isArray(routeLayer?.route?.stack)
    ? routeLayer.route.stack.map((entry: any) => entry.handle?.name || "<anonymous>")
    : [];

const createDependencies = (overrides: Record<string, unknown> = {}) => {
  const { app, getRouter } = createAppCapture();
  const appendAuditLog = vi.fn();
  const metricsRegistry = { inc: vi.fn() };
  const sessionIndexTouchTsBySid = new Map<string, string>();

  registerAuthRoutes({
    app,
    appendAuditLog,
    buildAuthRedirectUrl: vi.fn(({ appOrigin, path }) => `${appOrigin}${path}`),
    canAttemptAuth: vi.fn(async () => true),
    canVerifyMfa: vi.fn(async () => true),
    createDiscordAvatarUrl: vi.fn(() => "https://cdn.discordapp.com/avatars/user/hash.png"),
    discordApi: "https://discord.com/api",
    discordClientId: "client-id",
    discordClientSecret: "client-secret",
    ensureOwnerUser: vi.fn(),
    establishAuthenticatedSession: vi.fn(async () => undefined),
    getRequestIp: vi.fn(() => "203.0.113.5"),
    handleAuthFailureSecuritySignals: vi.fn(),
    handleMfaFailureSecuritySignals: vi.fn(),
    isAllowedOrigin: vi.fn(() => true),
    isTotpEnabledForUser: vi.fn(() => false),
    loadAllowedUsers: vi.fn(() => ["user-1"]),
    metricsRegistry,
    maybeEmitExcessiveSessionsEvent: vi.fn(),
    maybeEmitNewNetworkLoginEvent: vi.fn(),
    primaryAppOrigin: "https://example.com",
    resolveAuthAppOrigin: vi.fn(() => "https://example.com"),
    resolveDiscordRedirectUri: vi.fn(() => "https://example.com/login"),
    revokeUserSessionIndexRecord: vi.fn(),
    saveSessionState: vi.fn(async () => undefined),
    scopes: ["identify"],
    sessionCookieConfig: {
      name: "__Host-rainbow.sid",
      cookie: {
        httpOnly: true,
        maxAge: 123,
        path: "/",
        priority: "high",
        sameSite: "lax",
        secure: true,
      },
    },
    sessionIndexTouchTsBySid,
    syncPersistedDiscordAvatarForLogin: vi.fn(),
    updateSessionIndexFromRequest: vi.fn(),
    verifyTotpOrRecoveryCode: vi.fn(() => ({ method: "totp", ok: true })),
    ...overrides,
  });

  return {
    appendAuditLog,
    metricsRegistry,
    router: getRouter(),
    sessionIndexTouchTsBySid,
    ...overrides,
  };
};

describe("registerAuthRoutes", () => {
  it("rate limits Discord auth before generating oauth state", async () => {
    const canAttemptAuth = vi.fn(async () => false);
    const saveSessionState = vi.fn(async () => undefined);
    const dependencies = createDependencies({
      canAttemptAuth,
      saveSessionState,
    });
    const routeLayer = getRouteLayer(dependencies.router, "get", "/auth/discord");
    expect(getRouteHandlerNames(routeLayer)).toEqual([
      "<anonymous>",
      "enforceDiscordAuthAttemptRateLimit",
      "handleDiscordAuthStart",
    ]);
    const req = {
      query: {
        next: "/dashboard",
      },
      session: {},
    };

    const res = await invokeRoute(routeLayer, req);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(canAttemptAuth).toHaveBeenCalledWith("203.0.113.5");
    expect(saveSessionState).not.toHaveBeenCalled();
    expect(req.session).not.toHaveProperty("oauthState");
  });

  it("skips the oauth callback limiter when /login has no callback params", async () => {
    const canAttemptAuth = vi.fn(async () => false);
    const dependencies = createDependencies({
      canAttemptAuth,
    });
    const routeLayer = getRouteLayer(dependencies.router, "get", "/login");
    expect(getRouteHandlerNames(routeLayer)).toEqual([
      "requireOAuthCallbackParams",
      "<anonymous>",
      "enforceLoginCallbackAuthAttemptRateLimit",
      "prepareLoginCallbackContext",
      "handleLoginOAuthCallback",
    ]);

    const res = await invokeRoute(routeLayer, {
      query: {},
      session: {},
    });

    expect(res.nextArgs).toEqual(["route"]);
    expect(canAttemptAuth).not.toHaveBeenCalled();
  });

  it("rate limits the oauth callback before contacting Discord", async () => {
    const canAttemptAuth = vi.fn(async () => false);
    const resolveDiscordRedirectUri = vi.fn(() => "https://example.com/login");
    const dependencies = createDependencies({
      canAttemptAuth,
      resolveDiscordRedirectUri,
    });
    const routeLayer = getRouteLayer(dependencies.router, "get", "/login");

    const res = await invokeRoute(routeLayer, {
      query: {
        code: "discord-code",
        state: "oauth-state",
      },
      session: {
        loginAppOrigin: "https://example.com",
        oauthState: "oauth-state",
      },
    });

    expect(res.redirectUrl).toBe("https://example.com/login");
    expect(canAttemptAuth).toHaveBeenCalledWith("203.0.113.5");
    expect(resolveDiscordRedirectUri).not.toHaveBeenCalled();
    expect(dependencies.appendAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      "auth.login.rate_limited",
      "auth",
      {},
    );
  });

  it("rate limits MFA verification before code validation", async () => {
    const canVerifyMfa = vi.fn(async () => false);
    const verifyTotpOrRecoveryCode = vi.fn();
    const dependencies = createDependencies({
      canVerifyMfa,
      verifyTotpOrRecoveryCode,
    });
    const routeLayer = getRouteLayer(dependencies.router, "post", "/api/auth/mfa/verify");
    expect(getRouteHandlerNames(routeLayer)).toEqual([
      "<anonymous>",
      "attachPendingMfaUser",
      "enforcePendingMfaVerifyRateLimit",
      "handlePendingMfaVerification",
    ]);

    const res = await invokeRoute(routeLayer, {
      body: { code: "123456" },
      session: {
        pendingMfaUser: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(canVerifyMfa).toHaveBeenCalledWith("203.0.113.5");
    expect(verifyTotpOrRecoveryCode).not.toHaveBeenCalled();
    expect(dependencies.metricsRegistry.inc).toHaveBeenCalledWith("auth_mfa_verify_total", {
      status: "rate_limited",
    });
    expect(dependencies.appendAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      "auth.mfa.rate_limited",
      "auth",
      expect.objectContaining({
        action: "verify",
        userId: "user-1",
      }),
    );
  });

  it("rejects MFA verification before the handler when no pending session exists", async () => {
    const canVerifyMfa = vi.fn(async () => true);
    const verifyTotpOrRecoveryCode = vi.fn();
    const dependencies = createDependencies({
      canVerifyMfa,
      verifyTotpOrRecoveryCode,
    });
    const routeLayer = getRouteLayer(dependencies.router, "post", "/api/auth/mfa/verify");

    const res = await invokeRoute(routeLayer, {
      body: { code: "123456" },
      session: {},
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "mfa_not_pending" });
    expect(canVerifyMfa).not.toHaveBeenCalled();
    expect(verifyTotpOrRecoveryCode).not.toHaveBeenCalled();
  });

  it("clears the session cookie with the same secure attributes on logout", async () => {
    const revokeUserSessionIndexRecord = vi.fn();
    const dependencies = createDependencies({
      revokeUserSessionIndexRecord,
    });
    dependencies.sessionIndexTouchTsBySid.set("sid-1", "seen");
    const routeLayer = getRouteLayer(dependencies.router, "post", "/api/logout");
    const destroy = vi.fn((callback?: () => void) => callback?.());

    const res = await invokeRoute(routeLayer, {
      session: {
        destroy,
        pendingMfaUser: null,
        user: {
          id: "user-1",
        },
      },
      sessionID: "sid-1",
    });

    expect(destroy).toHaveBeenCalled();
    expect(revokeUserSessionIndexRecord).toHaveBeenCalledWith("sid-1", {
      revokedBy: "user-1",
      revokeReason: "logout",
    });
    expect(dependencies.sessionIndexTouchTsBySid.has("sid-1")).toBe(false);
    expect(res.clearedCookies).toEqual([
      {
        name: "__Host-rainbow.sid",
        options: {
          httpOnly: true,
          path: "/",
          priority: "high",
          sameSite: "lax",
          secure: true,
        },
      },
    ]);
    expect(res.body).toEqual({ ok: true });
  });
});
