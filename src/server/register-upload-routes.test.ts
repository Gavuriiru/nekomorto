import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";

import { registerUploadRoutes } from "../../server/routes/register-upload-routes.js";

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
      patch: register("PATCH"),
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

const invokeFinalHandler = async (route, req) => {
  const res = createMockRes();
  await route.handlers[route.handlers.length - 1](req, res);
  return res;
};

const createDependencies = ({ app, overrides = {} }) => ({
  MAX_SVG_SIZE_BYTES: 1024,
  MAX_UPLOAD_SIZE_BYTES: 1024 * 1024,
  PRIMARY_APP_ORIGIN: "https://dev.nekomata.moe",
  PUBLIC_UPLOADS_DIR: "D:/dev/nekomorto/public/uploads",
  STATIC_DEFAULT_CACHE_CONTROL: "public, max-age=0",
  app,
  appendAuditLog: vi.fn(),
  attachUploadMediaMetadata: vi.fn(async (entry) => entry),
  buildManagedStorageAreaSummary: vi.fn(() => []),
  canManageUploads: vi.fn(() => false),
  canUploadImage: vi.fn(() => true),
  cleanupUploadStagingWorkspace: vi.fn(),
  computeBufferSha256: vi.fn(() => "hash"),
  createSlug: vi.fn((value) => value),
  createUploadStagingWorkspace: vi.fn(() => ({})),
  deleteManagedUploadEntryAssets: vi.fn(async () => undefined),
  ensureUploadEntryHasRequiredVariants: vi.fn(async () => ({
    uploadEntry: null,
    variantsGenerated: false,
    variantGenerationError: "",
  })),
  extractRequestedUploadFocalPayload: vi.fn(() => ({})),
  findUploadByHash: vi.fn(() => null),
  getUploadFolderFromUrlValue: vi.fn(() => ""),
  getUploadExtFromMime: vi.fn(() => "png"),
  getUploadMimeFromExtension: vi.fn(() => "image/png"),
  getUploadVariantUrlPrefix: vi.fn(() => "/uploads/_variants/u1/"),
  hasOwnField: vi.fn((value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)),
  importRemoteImageFile: vi.fn(async () => null),
  invalidateUploadsCleanupPreviewCache: vi.fn(),
  isChapterBasedType: vi.fn(() => false),
  isPrivateUploadFolder: vi.fn(() => false),
  isUploadFolderAllowedInScope: vi.fn(() => true),
  loadCachedUploadsCleanupPreview: vi.fn(async () => null),
  loadComments: vi.fn(() => []),
  loadLinkTypes: vi.fn(() => []),
  loadPages: vi.fn(() => ({})),
  loadPosts: vi.fn(() => []),
  loadProjects: vi.fn(() => []),
  loadSiteSettings: vi.fn(() => ({})),
  loadUpdates: vi.fn(() => []),
  loadUploads: vi.fn(() => []),
  loadUsers: vi.fn(() => []),
  materializeUploadEntrySourceToStaging: vi.fn(async () => null),
  normalizeProjects: vi.fn((projects) => projects),
  normalizeUploadMime: vi.fn((mime) => mime),
  normalizeUploadScopeUserId: vi.fn((value) => String(value || "").trim()),
  normalizeVariants: vi.fn((value) => value || {}),
  persistUploadEntryFromStaging: vi.fn(async () => null),
  readUploadAltText: vi.fn(() => ""),
  readUploadFocalState: vi.fn(() => ({
    focalCrops: undefined,
    focalPoints: undefined,
    focalPoint: undefined,
  })),
  readUploadSlot: vi.fn(() => ""),
  readUploadSlotManaged: vi.fn(() => false),
  readUploadStorageProvider: vi.fn(() => "local"),
  requireAuth: vi.fn((_req, _res, next) => next?.()),
  resolveIncomingUploadFocalState: vi.fn(() => ({})),
  resolveRequestUploadAccessScope: vi.fn(() => ({
    allowed: true,
    hasFullAccess: false,
    allowedRoots: ["posts", "users", "projects"],
  })),
  resolveUploadAbsolutePath: vi.fn(() => ""),
  resolveUploadVariantPresetKeysForArea: vi.fn(() => []),
  runUploadsCleanup: vi.fn(async () => ({})),
  sanitizeSvg: vi.fn((input) => input),
  sanitizeUploadBaseName: vi.fn((value) => value),
  sanitizeUploadFolder: vi.fn((value) => value),
  sanitizeUploadSlot: vi.fn((value) => value),
  shouldIncludeUploadInHashDedupe: vi.fn(() => true),
  upsertUploadEntries: vi.fn(() => []),
  uploadStorageService: {},
  validateUploadImageBuffer: vi.fn(async () => undefined),
  writeComments: vi.fn(),
  writeLinkTypes: vi.fn(),
  writePages: vi.fn(),
  writePosts: vi.fn(),
  writeProjects: vi.fn(),
  writeSiteSettings: vi.fn(),
  writeUploadBufferToStaging: vi.fn(async () => undefined),
  writeUpdates: vi.fn(),
  writeUploads: vi.fn(),
  writeUsers: vi.fn(),
  ...overrides,
});

describe("registerUploadRoutes", () => {
  it("lista metadados e arquivos locais soltos dentro da pasta solicitada", async () => {
    const { app, routes } = createAppRecorder();
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-routes-users-"));
    fs.mkdirSync(path.join(uploadsDir, "users"), { recursive: true });
    fs.mkdirSync(path.join(uploadsDir, "posts"), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, "users", "loose.png"), "users");
    fs.writeFileSync(path.join(uploadsDir, "posts", "hidden.png"), "posts");
    const dependencies = createDependencies({
      app,
      overrides: {
        PUBLIC_UPLOADS_DIR: uploadsDir,
        loadUploads: vi.fn(() => [
          {
            id: "upload-users-root",
            url: "/uploads/users/avatar.png",
            folder: "users",
            fileName: "avatar.png",
            mime: "image/png",
            size: 120,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "upload-users-child",
            url: "/uploads/users/nested/child.png",
            folder: "users/nested",
            fileName: "child.png",
            mime: "image/png",
            size: 180,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
          {
            id: "upload-posts-root",
            url: "/uploads/posts/post.png",
            folder: "posts",
            fileName: "post.png",
            mime: "image/png",
            size: 200,
            createdAt: "2024-01-03T00:00:00.000Z",
          },
        ]),
      },
    });
    try {
      registerUploadRoutes(dependencies);

      const route = getRoute(routes, "GET", "/api/uploads/list");
      expect(route).toBeTruthy();
      expect(route.handlers).toHaveLength(2);
      expect(route.handlers[0]).toBe(dependencies.requireAuth);

      const res = await invokeFinalHandler(route, {
        query: {
          folder: "users",
          recursive: "1",
          scopeUserId: "user-1",
        },
        session: {
          user: {
            id: "user-1",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.files.map((item) => item.url)).toEqual([
        "/uploads/users/avatar.png",
        "/uploads/users/loose.png",
        "/uploads/users/nested/child.png",
      ]);
      expect(res.body.files.some((item) => item.url === "/uploads/posts/post.png")).toBe(false);
      expect(res.body.files.some((item) => item.url === "/uploads/posts/hidden.png")).toBe(false);
    } finally {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  it("mantem 403 quando o escopo e resolvido mas o acesso e negado", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        resolveRequestUploadAccessScope: vi.fn(() => ({
          allowed: false,
          hasFullAccess: false,
          allowedRoots: ["posts"],
        })),
      },
    });

    registerUploadRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/uploads/list");
    expect(route).toBeTruthy();

    const res = await invokeFinalHandler(route, {
      query: {
        folder: "users",
        recursive: "1",
        scopeUserId: "380305493391966208",
      },
      session: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("lista uploads de branding sem misturar outros roots", async () => {
    const { app, routes } = createAppRecorder();
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-routes-branding-"));
    fs.mkdirSync(path.join(uploadsDir, "branding"), { recursive: true });
    fs.mkdirSync(path.join(uploadsDir, "users"), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, "branding", "wordmark.png"), "branding");
    fs.writeFileSync(path.join(uploadsDir, "users", "hidden.png"), "users");
    const dependencies = createDependencies({
      app,
      overrides: {
        PUBLIC_UPLOADS_DIR: uploadsDir,
        loadUploads: vi.fn(() => [
          {
            id: "upload-branding-root",
            url: "/uploads/branding/logo.png",
            folder: "branding",
            fileName: "logo.png",
            mime: "image/png",
            size: 120,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "upload-users-root",
            url: "/uploads/users/avatar.png",
            folder: "users",
            fileName: "avatar.png",
            mime: "image/png",
            size: 180,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ]),
      },
    });

    try {
      registerUploadRoutes(dependencies);

      const route = getRoute(routes, "GET", "/api/uploads/list");
      expect(route).toBeTruthy();

      const res = await invokeFinalHandler(route, {
        query: {
          folder: "branding",
          recursive: "1",
        },
        session: {
          user: {
            id: "user-1",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.files.map((item) => item.url)).toEqual([
        "/uploads/branding/logo.png",
        "/uploads/branding/wordmark.png",
      ]);
      expect(res.body.files.some((item) => item.url === "/uploads/users/avatar.png")).toBe(false);
      expect(res.body.files.some((item) => item.url === "/uploads/users/hidden.png")).toBe(false);
    } finally {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  it("anexa metadados do projeto aos uploads dentro de roots de projeto", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadProjects: vi.fn(() => [
          {
            id: "proj-1",
            title: "Projeto Um",
          },
        ]),
        loadUploads: vi.fn(() => [
          {
            id: "upload-project-page",
            url: "/uploads/projects/proj-1/capitulos/volume-1/capitulo-2/pagina-1.png",
            folder: "projects/proj-1/capitulos/volume-1/capitulo-2",
            fileName: "pagina-1.png",
            mime: "image/png",
            size: 120,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ]),
      },
    });

    registerUploadRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/uploads/list");
    expect(route).toBeTruthy();

    const res = await invokeFinalHandler(route, {
      query: {
        folder: "projects",
        recursive: "1",
      },
      session: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/uploads/projects/proj-1/capitulos/volume-1/capitulo-2/pagina-1.png",
          projectId: "proj-1",
          projectTitle: "Projeto Um",
        }),
      ]),
    );
  });

  it("lista __all__ respeitando apenas os roots autorizados", async () => {
    const { app, routes } = createAppRecorder();
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-routes-all-"));
    fs.mkdirSync(path.join(uploadsDir, "users"), { recursive: true });
    fs.mkdirSync(path.join(uploadsDir, "posts"), { recursive: true });
    fs.mkdirSync(path.join(uploadsDir, "projects"), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, "users", "loose.png"), "users");
    fs.writeFileSync(path.join(uploadsDir, "posts", "loose.png"), "posts");
    fs.writeFileSync(path.join(uploadsDir, "projects", "loose.png"), "projects");
    const dependencies = createDependencies({
      app,
      overrides: {
        PUBLIC_UPLOADS_DIR: uploadsDir,
        isUploadFolderAllowedInScope: vi.fn((folder, accessScope) => {
          if (accessScope?.hasFullAccess) {
            return true;
          }
          const root = String(folder || "").split("/")[0] || "";
          return Array.isArray(accessScope?.allowedRoots) && accessScope.allowedRoots.includes(root);
        }),
        loadUploads: vi.fn(() => [
          {
            id: "upload-users-root",
            url: "/uploads/users/avatar.png",
            folder: "users",
            fileName: "avatar.png",
            mime: "image/png",
            size: 120,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "upload-posts-root",
            url: "/uploads/posts/post.png",
            folder: "posts",
            fileName: "post.png",
            mime: "image/png",
            size: 200,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
          {
            id: "upload-projects-root",
            url: "/uploads/projects/proj-1/cover.png",
            folder: "projects/proj-1",
            fileName: "cover.png",
            mime: "image/png",
            size: 300,
            createdAt: "2024-01-03T00:00:00.000Z",
          },
        ]),
        resolveRequestUploadAccessScope: vi.fn(() => ({
          allowed: true,
          hasFullAccess: false,
          allowedRoots: ["users", "posts"],
        })),
      },
    });

    try {
      registerUploadRoutes(dependencies);

      const route = getRoute(routes, "GET", "/api/uploads/list");
      expect(route).toBeTruthy();

      const res = await invokeFinalHandler(route, {
        query: {
          folder: "__all__",
          scopeUserId: "user-1",
        },
        session: {
          user: {
            id: "user-1",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.files.map((item) => item.url)).toEqual([
        "/uploads/posts/loose.png",
        "/uploads/posts/post.png",
        "/uploads/users/avatar.png",
        "/uploads/users/loose.png",
      ]);
      expect(
        res.body.files.some((item) => item.url === "/uploads/projects/proj-1/cover.png"),
      ).toBe(false);
      expect(
        res.body.files.some((item) => item.url === "/uploads/projects/loose.png"),
      ).toBe(false);
    } finally {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  it("degrada para lista vazia quando a leitura interna falha", async () => {
    const { app, routes } = createAppRecorder();
    const dependencies = createDependencies({
      app,
      overrides: {
        loadUploads: vi.fn(() => {
          throw new Error("read_failed");
        }),
      },
    });

    registerUploadRoutes(dependencies);

    const route = getRoute(routes, "GET", "/api/uploads/list");
    expect(route).toBeTruthy();

    const res = await invokeFinalHandler(route, {
      query: {
        folder: "branding",
        recursive: "1",
      },
      session: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ files: [] });
  });
});
