import { describe, expect, it, vi } from "vitest";

import { registerContentRoutes } from "../../server/routes/register-content-routes.js";

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
  PUBLIC_READ_CACHE_TAGS: { POSTS: "posts" },
  PUBLIC_READ_CACHE_TTL_MS: 60_000,
  app,
  appendAnalyticsEvent: vi.fn(),
  appendAuditLog: vi.fn(),
  appendPostVersion: vi.fn(),
  applyCommentCountToPosts: vi.fn((posts, comments, targetId) =>
    posts.map((post) =>
      post.slug === targetId
        ? {
            ...post,
            commentsCount: comments.filter(
              (comment) => comment.status === "approved" && comment.targetId === targetId,
            ).length,
          }
        : post,
    ),
  ),
  applyCommentCountToProjects: vi.fn((projects, comments, targetId) =>
    projects.map((project) =>
      project.id === targetId
        ? {
            ...project,
            commentsCount: comments.filter(
              (comment) => comment.status === "approved" && comment.targetId === targetId,
            ).length,
          }
        : project,
    ),
  ),
  applyPostSnapshotForRollback: vi.fn(),
  buildEditorialCalendarItems: vi.fn(() => []),
  buildGravatarUrl: vi.fn((emailHash) => `https://gravatar.test/${emailHash}`),
  buildPublicMediaVariants: vi.fn(() => ({})),
  bulkModeratePendingComments: vi.fn(() => ({
    ok: true,
    action: "approve_all",
    processedComments: [],
    comments: [],
    processedCount: 0,
    totalPendingBefore: 0,
    remainingPending: 0,
  })),
  canManageComments: vi.fn(() => true),
  canManagePosts: vi.fn(() => true),
  canManageSettings: vi.fn(() => true),
  canRegisterPollVote: vi.fn(async () => true),
  canRegisterView: vi.fn(async () => true),
  canSubmitComment: vi.fn(async () => true),
  collectLinkTypeIconUploads: vi.fn(() => []),
  createGravatarHash: vi.fn((email) => `hash:${email}`),
  createRevisionToken: vi.fn(() => "revision-token"),
  createSlug: vi.fn((value) => String(value || "").trim().toLowerCase()),
  createUniqueSlug: vi.fn((value) => String(value || "").trim().toLowerCase()),
  deletePrivateUploadByUrl: vi.fn(),
  dispatchEditorialWebhookEvent: vi.fn(),
  ensureNoEditConflict: vi.fn(() => true),
  incrementPostViews: vi.fn(),
  isWithinRestoreWindow: vi.fn(() => true),
  listPostVersions: vi.fn(() => []),
  loadComments: vi.fn(() => []),
  loadLinkTypes: vi.fn(() => []),
  loadPostVersions: vi.fn(() => []),
  loadPosts: vi.fn(() => []),
  loadProjects: vi.fn(() => []),
  normalizeEmail: vi.fn((value) => String(value || "").trim().toLowerCase()),
  normalizeLinkTypes: vi.fn((value) => value),
  normalizePosts: vi.fn((value) => value),
  normalizeProjects: vi.fn((value) => value),
  normalizeTags: vi.fn((value) => value),
  parseEditRevisionOptions: vi.fn(() => ({})),
  postVersionReasonLabel: vi.fn(() => "manual"),
  readPublicCachedJson: vi.fn(() => null),
  requireAuth: vi.fn((_req, _res, next) => next?.()),
  resolveGravatarAvatarUrl: vi.fn(async (emailHash) => `https://avatar.test/${emailHash}`),
  resolvePostCover: vi.fn(() => null),
  resolvePostStatus: vi.fn(() => "published"),
  runAutoUploadReorganization: vi.fn(async () => {}),
  updateLexicalPollVotes: vi.fn(() => ({ updated: false, content: null })),
  writeComments: vi.fn(),
  writeLinkTypes: vi.fn(),
  writePosts: vi.fn(),
  writeProjects: vi.fn(),
  writePublicCachedJson: vi.fn(),
  ...overrides,
});

describe("registerContentRoutes", () => {
  it("preserves the pending comments payload without status while keeping target metadata", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadComments: vi.fn(() => [
          {
            id: "comment-1",
            targetType: "post",
            targetId: "post-1",
            parentId: null,
            name: "Leitor",
            content: "Primeiro!",
            createdAt: "2026-04-01T12:00:00.000Z",
            status: "pending",
            emailHash: "hash:reader@example.com",
            avatarUrl: "",
          },
        ]),
        loadPosts: vi.fn(() => [
          {
            slug: "post-1",
            title: "Post de Teste",
            publishedAt: "2026-03-01T00:00:00.000Z",
            status: "published",
          },
        ]),
      },
    });

    registerContentRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/comments/pending");
    expect(route.handlers[0]).toBe(dependencies.requireAuth);

    const res = await invokeFinalHandler(route, {
      session: {
        user: {
          id: "owner-1",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      comments: [
        {
          id: "comment-1",
          targetType: "post",
          targetId: "post-1",
          parentId: null,
          name: "Leitor",
          content: "Primeiro!",
          createdAt: "2026-04-01T12:00:00.000Z",
          avatarUrl: "https://gravatar.test/hash:reader@example.com",
          targetLabel: "Post de Teste",
          targetUrl: "https://nekomata.moe/postagem/post-1#comment-comment-1",
        },
      ],
    });
    expect(res.body.comments[0]).not.toHaveProperty("status");
  });

  it("preserves status on the recent comments payload and reports pending counts", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadComments: vi.fn(() => [
          {
            id: "comment-approved",
            targetType: "project",
            targetId: "project-1",
            name: "Equipe",
            content: "Aprovado",
            createdAt: "2026-04-01T13:00:00.000Z",
            status: "approved",
            avatarUrl: "https://cdn.example.com/team.png",
          },
          {
            id: "comment-pending",
            targetType: "project",
            targetId: "project-1",
            name: "Leitor",
            content: "Pendente",
            createdAt: "2026-04-01T12:00:00.000Z",
            status: "pending",
            avatarUrl: "",
            emailHash: "hash:pending@example.com",
          },
        ]),
        loadProjects: vi.fn(() => [
          {
            id: "project-1",
            title: "Projeto Teste",
          },
        ]),
      },
    });

    registerContentRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/comments/recent");
    const res = await invokeFinalHandler(route, {
      query: {},
      session: {
        user: {
          id: "owner-1",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      comments: [
        expect.objectContaining({
          id: "comment-approved",
          status: "approved",
          targetLabel: "Projeto Teste",
          targetUrl: "https://nekomata.moe/projeto/project-1#comment-comment-approved",
        }),
        expect.objectContaining({
          id: "comment-pending",
          status: "pending",
        }),
      ],
      pendingCount: 1,
      totalCount: 2,
    });
  });

  it("returns volume_required for ambiguous published chapter comment targets without changing the route contract", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadProjects: vi.fn(() => [
          {
            id: "project-1",
            type: "Light Novel",
            deletedAt: null,
            episodeDownloads: [
              {
                number: 7,
                volume: 1,
                publicationStatus: "published",
                content: '{"root":{"children":[{"type":"paragraph"}]}}',
                sources: [],
              },
              {
                number: 7,
                volume: 2,
                publicationStatus: "published",
                content: '{"root":{"children":[{"type":"paragraph"}]}}',
                sources: [],
              },
            ],
          },
        ]),
      },
    });

    registerContentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/comments");
    const res = await invokeFinalHandler(route, {
      body: {
        targetType: "chapter",
        targetId: "project-1",
        chapterNumber: 7,
        name: "Leitor",
        email: "reader@example.com",
        content: "Comentando sem volume",
      },
      headers: {},
      ip: "127.0.0.1",
      session: null,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "volume_required" });
    expect(dependencies.writeComments).not.toHaveBeenCalled();
  });

  it("rejects comments for legacy-invalid published chapters without public content", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadProjects: vi.fn(() => [
          {
            id: "project-1",
            type: "Light Novel",
            deletedAt: null,
            episodeDownloads: [
              {
                number: 8,
                volume: 1,
                publicationStatus: "published",
                content: "",
                sources: [],
              },
            ],
          },
        ]),
      },
    });

    registerContentRoutes(dependencies);

    const route = getRoute(routes, "POST", "/api/public/comments");
    const res = await invokeFinalHandler(route, {
      body: {
        targetType: "chapter",
        targetId: "project-1",
        chapterNumber: 8,
        chapterVolume: 1,
        name: "Leitor",
        email: "reader@example.com",
        content: "Comentando sem conteudo publico",
      },
      headers: {},
      ip: "127.0.0.1",
      session: null,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "target_not_found" });
    expect(dependencies.writeComments).not.toHaveBeenCalled();
  });
});
