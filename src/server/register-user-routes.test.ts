import { describe, expect, it, vi } from "vitest";

import { AccessRole, PermissionId } from "../../server/lib/authz.js";
import { registerUserRoutes } from "../../server/routes/register-user-routes.js";

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

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
      put: register("PUT"),
      delete: register("DELETE"),
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

const invokeRouteHandlers = async (route, req) => {
  const res = createMockRes();
  let index = 0;
  const next = async () => {
    const handler = route.handlers[index];
    index += 1;
    if (!handler) {
      return;
    }
    await handler(req, res, next);
  };
  await next();
  return res;
};

const createDependencies = ({ app, overrides = {} }) => {
  const requireAuth = vi.fn((_req, _res, next) => next?.());
  const requirePrimaryOwner = vi.fn((_req, _res, next) => next?.());

  return {
    AccessRole,
    BASIC_PROFILE_FIELDS: [
      "name",
      "phrase",
      "bio",
      "avatarUrl",
      "avatarDisplay",
      "socials",
      "favoriteWorks",
    ],
    BOOTSTRAP_TOKEN: "bootstrap-token",
    PermissionId,
    SecurityEventSeverity: { WARNING: "warning" },
    app,
    appendAuditLog: vi.fn(),
    applyOwnerRole: vi.fn((user) => user),
    buildPublicMediaVariants: vi.fn(() => ({})),
    buildPublicTeamMembers: vi.fn(() => []),
    buildUserProfileRevisionToken: vi.fn(() => "current-revision"),
    can: vi.fn(() => true),
    canBootstrap: vi.fn(async () => true),
    canManageUsersAccess: vi.fn(() => true),
    canManageUsersBasic: vi.fn(() => true),
    defaultPermissionsForRole: vi.fn(() => ["default-permission"]),
    emitSecurityEvent: vi.fn(),
    enforceUserAccessInvariants: vi.fn((users) => users),
    ensureNoEditConflict: vi.fn(() => true),
    ensureOwnerUser: vi.fn(),
    getRequestIp: vi.fn((req) => String(req?.ip || "").trim()),
    getPrimaryOwnerId: vi.fn(() => "owner-1"),
    getUserAccessContextById: vi.fn(() => ({
      accessRole: AccessRole.NORMAL,
      grants: {},
      isOwner: false,
      isPrimaryOwner: false,
    })),
    isAdminUser: vi.fn(() => true),
    isBasicProfileField: vi.fn((field) =>
      ["name", "phrase", "bio", "avatarUrl", "avatarDisplay", "socials", "favoriteWorks"].includes(
        field,
      ),
    ),
    isOwner: vi.fn((id) => String(id) === "owner-1"),
    isPrimaryOwner: vi.fn((id) => String(id) === "owner-1"),
    isRbacV2Enabled: false,
    loadOwnerIds: vi.fn(() => ["owner-1"]),
    loadUploads: vi.fn(() => []),
    loadUsers: vi.fn(() => []),
    normalizeAccessRole: vi.fn((value, fallback) => value || fallback),
    normalizeAvatarDisplay: vi.fn((value) => value || { x: 0, y: 0, zoom: 1, rotation: 0 }),
    normalizeUsers: vi.fn((users) => users),
    parseEditRevisionOptions: vi.fn(() => ({})),
    pickBasicProfilePatch: vi.fn((update) => update),
    removeOwnerRoleLabel: vi.fn((roles) => roles),
    requireAuth,
    requirePrimaryOwner,
    resolveDiscordAvatarFallbackUrl: vi.fn((value) => value || null),
    sanitizeFavoriteWorksByCategory: vi.fn((value) => value || []),
    sanitizePermissionsForStorage: vi.fn((value) => value || []),
    sanitizeSocials: vi.fn((value) => value || []),
    shouldEmitSecurityRuleEvent: vi.fn(() => true),
    syncAllowedUsers: vi.fn(),
    syncSessionUserDisplayProfile: vi.fn(),
    userWithAccessForResponse: vi.fn((user) => ({
      ...user,
      username: user?.username || user?.id || "",
    })),
    withEffectiveAvatarUrl: vi.fn((user, fallbackAvatarUrl = null) => ({
      ...user,
      avatarUrl: user?.avatarUrl || fallbackAvatarUrl || null,
    })),
    withUserProfileRevision: vi.fn((user) => ({
      ...user,
      revision: "response-revision",
    })),
    writeOwnerIds: vi.fn(),
    writeUsers: vi.fn(),
    ...overrides,
  };
};

describe("registerUserRoutes", () => {
  it("uses the trusted request ip helper for bootstrap-owner throttling", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        canBootstrap: vi.fn(async () => false),
        getRequestIp: vi.fn(() => "trusted-ip"),
      },
    });

    registerUserRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/bootstrap-owner");
    expect(route.handlers[0]).toBe(dependencies.requireAuth);

    const res = await invokeFinalHandler(route, {
      body: { token: "bootstrap-token" },
      headers: { "x-forwarded-for": "198.51.100.99" },
      ip: "127.0.0.1",
      session: {
        user: {
          id: "owner-1",
        },
      },
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(dependencies.getRequestIp).toHaveBeenCalled();
    expect(dependencies.canBootstrap).toHaveBeenCalledWith("trusted-ip");
  });

  it("keeps requireAuth on legacy mutation routes and returns the expected create payload", async () => {
    const { app, routes } = createAppRecorder();
    let storedUsers = [];
    const dependencies = createDependencies({
      app,
      overrides: {
        isRbacV2Enabled: false,
        loadUsers: vi.fn(() => cloneJson(storedUsers)),
        normalizeUsers: vi.fn((users) => users),
        writeUsers: vi.fn((users) => {
          storedUsers = cloneJson(users);
        }),
        withUserProfileRevision: vi.fn((user) => ({
          ...user,
          revision: "legacy-revision",
        })),
      },
    });

    registerUserRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/users");
    expect(route.handlers).toHaveLength(2);
    expect(route.handlers[0]).toBe(dependencies.requireAuth);

    const res = await invokeFinalHandler(route, {
      body: {
        id: "user-2",
        name: "Alice",
        socials: [{ type: "discord", url: "https://discord.gg/x" }],
      },
      session: {
        user: {
          id: "owner-1",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      user: expect.objectContaining({
        id: "user-2",
        name: "Alice",
        revision: "legacy-revision",
      }),
    });
    expect(dependencies.writeUsers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "user-2",
        name: "Alice",
        order: 0,
      }),
    ]);
    expect(dependencies.appendAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      "users.create",
      "users",
      { id: "user-2" },
    );
  });

  it("passes SecurityEventSeverity into legacy managed user warning events", async () => {
    const { app, routes } = createAppRecorder();
    let storedUsers = [
      {
        id: "owner-1",
        name: "Owner",
        phrase: "",
        bio: "",
        avatarUrl: null,
        avatarDisplay: { x: 0, y: 0, zoom: 1, rotation: 0 },
        socials: [],
        favoriteWorks: [],
        status: "active",
        permissions: ["*"],
        roles: [],
        accessRole: AccessRole.OWNER_PRIMARY,
        order: 0,
        username: "owner-1",
      },
    ];
    const dependencies = createDependencies({
      app,
      overrides: {
        SecurityEventSeverity: { WARNING: "warning-sentinel" },
        isRbacV2Enabled: false,
        loadUsers: vi.fn(() => cloneJson(storedUsers)),
        normalizeUsers: vi.fn((users) => users),
        writeUsers: vi.fn((users) => {
          storedUsers = cloneJson(users);
        }),
        withUserProfileRevision: vi.fn((user) => ({
          ...user,
          revision: "legacy-revision",
        })),
      },
    });

    registerUserRoutes(dependencies);

    const route = getRoute(routes, "PUT", "/api/users/:id");

    const res = await invokeFinalHandler(route, {
      body: {
        permissions: [],
      },
      params: { id: "owner-1" },
      session: {
        user: {
          id: "owner-1",
          avatarUrl: "https://cdn.discordapp.com/avatars/1/avatar.png",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      user: expect.objectContaining({
        id: "owner-1",
        revision: "legacy-revision",
      }),
    });
    expect(dependencies.emitSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "privilege_escalation_warning",
        severity: "warning-sentinel",
        actorUserId: "owner-1",
        targetUserId: "owner-1",
      }),
    );
  });

  it("runs requireAuth before PUT /api/users/:id and preserves the RBAC v2 response shape", async () => {
    const { app, routes } = createAppRecorder();
    let storedUsers = [
      {
        id: "owner-1",
        name: "Owner",
        phrase: "",
        bio: "",
        avatarUrl: null,
        avatarDisplay: { x: 0, y: 0, zoom: 1, rotation: 0 },
        socials: [],
        favoriteWorks: [],
        status: "active",
        permissions: ["*"],
        roles: [],
        accessRole: AccessRole.OWNER_PRIMARY,
        order: 0,
        username: "owner-1",
      },
      {
        id: "user-2",
        name: "Old Name",
        phrase: "",
        bio: "",
        avatarUrl: null,
        avatarDisplay: { x: 0, y: 0, zoom: 1, rotation: 0 },
        socials: [],
        favoriteWorks: [],
        status: "active",
        permissions: ["posts"],
        roles: ["reviewer"],
        accessRole: AccessRole.NORMAL,
        order: 1,
        username: "user-2",
      },
    ];
    const dependencies = createDependencies({
      app,
      overrides: {
        isRbacV2Enabled: true,
        loadUsers: vi.fn(() => cloneJson(storedUsers)),
        loadOwnerIds: vi.fn(() => ["owner-1"]),
        writeUsers: vi.fn((users) => {
          storedUsers = cloneJson(users);
        }),
        getUserAccessContextById: vi.fn((userId) => {
          if (String(userId) === "owner-1") {
            return {
              accessRole: AccessRole.OWNER_PRIMARY,
              grants: { all: true },
              isOwner: true,
              isPrimaryOwner: true,
            };
          }
          return {
            accessRole: AccessRole.NORMAL,
            grants: {},
            isOwner: false,
            isPrimaryOwner: false,
          };
        }),
        pickBasicProfilePatch: vi.fn((update) => ({
          name: update.name,
        })),
        requireAuth: vi.fn((req, res, next) => {
          if (!req.session?.user) {
            return res.status(401).json({ error: "unauthorized" });
          }
          return next?.();
        }),
        withUserProfileRevision: vi.fn((user) => ({
          ...user,
          revision: "rbac-revision",
        })),
      },
    });

    registerUserRoutes(dependencies);

    const route = getRoute(routes, "PUT", "/api/users/:id");
    expect(route.handlers).toHaveLength(2);
    expect(route.handlers[0]).toBe(dependencies.requireAuth);

    const unauthorized = await invokeRouteHandlers(route, {
      body: { name: "Ignored" },
      params: { id: "user-2" },
      session: null,
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body).toEqual({ error: "unauthorized" });

    const res = await invokeRouteHandlers(route, {
      body: { name: "Updated Name" },
      params: { id: "user-2" },
      session: {
        user: {
          id: "owner-1",
          avatarUrl: "https://cdn.discordapp.com/avatars/1/avatar.png",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      user: expect.objectContaining({
        id: "user-2",
        name: "Updated Name",
        revision: "rbac-revision",
      }),
    });
    expect(dependencies.writeUsers).toHaveBeenCalled();
    expect(dependencies.appendAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      "users.update",
      "users",
      expect.objectContaining({
        id: "user-2",
        before: expect.any(Object),
        after: expect.objectContaining({ name: "Updated Name" }),
      }),
    );
  });
});
