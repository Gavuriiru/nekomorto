import { describe, expect, it, vi } from "vitest";

import { registerContentCommentRoutes } from "../../server/routes/content/register-content-comment-routes.js";

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
        handlers,
        method,
        path,
      });
    };

  return {
    app: {
      delete: register("DELETE"),
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
  app,
  appendAnalyticsEvent: vi.fn(),
  appendAuditLog: vi.fn(),
  applyCommentCountToPosts: vi.fn((posts) => posts),
  applyCommentCountToProjects: vi.fn((projects) => projects),
  buildGravatarUrl: vi.fn((hash) => `https://gravatar.example/${hash}`),
  bulkModeratePendingComments: vi.fn(() => ({
    action: "approve_all",
    comments: [],
    ok: true,
    processedComments: [],
    processedCount: 0,
    remainingPending: 0,
    totalPendingBefore: 0,
  })),
  canManageComments: vi.fn(() => false),
  canSubmitComment: vi.fn(async () => true),
  createGravatarHash: vi.fn((email) => `hash:${email}`),
  getRequestIp: vi.fn((req) => String(req?.ip || "").trim()),
  loadComments: vi.fn(() => []),
  loadPosts: vi.fn(() => []),
  loadProjects: vi.fn(() => []),
  normalizeEmail: vi.fn((value) => String(value || "").trim().toLowerCase()),
  normalizePosts: vi.fn((posts) => posts),
  normalizeProjects: vi.fn((projects) => projects),
  requireAuth: vi.fn((_req, _res, next) => next?.()),
  resolveGravatarAvatarUrl: vi.fn(async (hash) => `https://avatar.example/${hash}`),
  writeComments: vi.fn(),
  writePosts: vi.fn(),
  writeProjects: vi.fn(),
  ...overrides,
});

describe("registerContentCommentRoutes", () => {
  it("uses the trusted request ip helper for public comment throttling", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        canSubmitComment: vi.fn(async () => false),
        getRequestIp: vi.fn(() => "trusted-ip"),
      },
    });

    registerContentCommentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/comments");
    const res = await invokeFinalHandler(route, {
      body: {
        content: "Novo comentario",
        email: "reader@example.com",
        name: "Leitor",
        targetId: "project-1",
        targetType: "project",
      },
      headers: { "x-forwarded-for": "198.51.100.99" },
      ip: "127.0.0.1",
      session: {},
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate_limited" });
    expect(dependencies.getRequestIp).toHaveBeenCalled();
    expect(dependencies.canSubmitComment).toHaveBeenCalledWith("trusted-ip");
  });

  it("creates approved staff comments and emits both creation and approval analytics", async () => {
    const { app, routes } = createAppRecorder();
    const comments: Array<Record<string, any>> = [];
    const dependencies = createDependencies({
      app,
      overrides: {
        canManageComments: vi.fn((userId) => String(userId) === "staff-1"),
        loadComments: vi.fn(() => comments),
        loadProjects: vi.fn(() => [{ id: "project-1" }]),
        writeComments: vi.fn((nextComments) => {
          comments.splice(0, comments.length, ...nextComments);
        }),
      },
    });

    registerContentCommentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/comments");
    const res = await invokeFinalHandler(route, {
      body: {
        content: "Novo comentário",
        name: "Ignorado",
        targetId: "project-1",
        targetType: "project",
      },
      headers: {},
      ip: "127.0.0.1",
      session: {
        user: {
          avatarUrl: "/uploads/team.png",
          email: "staff@example.com",
          id: "staff-1",
          name: "Equipe",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      comment: {
        id: expect.any(String),
        status: "approved",
      },
    });
    expect(comments).toEqual([
      expect.objectContaining({
        avatarUrl: "/uploads/team.png",
        content: "Novo comentário",
        name: "Equipe",
        status: "approved",
        targetId: "project-1",
        targetType: "project",
      }),
    ]);
    expect(dependencies.appendAnalyticsEvent).toHaveBeenCalledTimes(2);
    expect(dependencies.appendAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        eventType: "comment_created",
      }),
    );
    expect(dependencies.appendAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({
        eventType: "comment_approved",
      }),
    );
  });

  it("rejects comment replies that point to a different target", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadComments: vi.fn(() => [
          {
            id: "parent-1",
            targetId: "project-2",
            targetType: "project",
          },
        ]),
        loadProjects: vi.fn(() => [{ id: "project-1" }]),
      },
    });

    registerContentCommentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/comments");
    const res = await invokeFinalHandler(route, {
      body: {
        content: "Resposta",
        name: "Leitor",
        parentId: "parent-1",
        targetId: "project-1",
        targetType: "project",
      },
      headers: {},
      ip: "127.0.0.1",
      session: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid_parent" });
    expect(dependencies.writeComments).not.toHaveBeenCalled();
  });

  it("approves pending comments and syncs target counts", async () => {
    const { app, routes } = createAppRecorder();
    const comments = [
      {
        content: "Pendente",
        id: "comment-1",
        status: "pending",
        targetId: "project-1",
        targetType: "project",
      },
    ];
    const dependencies = createDependencies({
      app,
      overrides: {
        canManageComments: vi.fn(() => true),
        loadComments: vi.fn(() => comments),
        loadProjects: vi.fn(() => [{ id: "project-1", commentsCount: 0 }]),
        writeComments: vi.fn(),
      },
    });

    registerContentCommentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/comments/:id/approve");
    const res = await invokeFinalHandler(route, {
      params: { id: "comment-1" },
      session: { user: { id: "manager-1" } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(dependencies.writeComments).toHaveBeenCalledWith([
      expect.objectContaining({
        approvedAt: expect.any(String),
        id: "comment-1",
        status: "approved",
      }),
    ]);
    expect(dependencies.writeProjects).toHaveBeenCalled();
    expect(dependencies.appendAnalyticsEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventType: "comment_approved",
        resourceId: "comment-1",
      }),
    );
  });
});
