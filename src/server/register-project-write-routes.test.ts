import { describe, expect, it, vi } from "vitest";

import { registerProjectWriteRoutes } from "../../server/routes/project/register-project-write-routes.js";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

describe("registerProjectWriteRoutes", () => {
  it("salva projetos existentes usando collectEpisodeUpdatesByVisibility sem estourar erro", async () => {
    const routeState = {
      updateHandler: null as
        | ((
            req: Record<string, unknown>,
            res: ReturnType<typeof createResponse>,
          ) => Promise<unknown>)
        | null,
    };

    const app = {
      post: vi.fn(),
      put: vi.fn((path: string, _middleware: unknown, handler: typeof routeState.updateHandler) => {
        if (path === "/api/projects/:id") {
          routeState.updateHandler = handler;
        }
      }),
      delete: vi.fn(),
      get: vi.fn(),
    };

    const existingProject = {
      id: "105333",
      title: "Projeto original",
      cover: "",
      episodeDownloads: [],
      volumeEntries: [],
    };
    const nextProject = {
      ...existingProject,
      title: "Projeto atualizado",
      updatedAt: "2026-03-29T00:00:00.000Z",
    };
    const collectEpisodeUpdatesByVisibility = vi.fn(() => []);
    const loadProjects = vi
      .fn()
      .mockReturnValueOnce([existingProject])
      .mockReturnValueOnce([nextProject]);
    const writeProjects = vi.fn();

    registerProjectWriteRoutes({
      app,
      PUBLIC_UPLOADS_DIR: "/uploads",
      appendAuditLog: vi.fn(),
      applyEpisodePublicationMetadata: vi.fn((_prev, merged) => merged),
      applyProjectChapterUpdate: vi.fn(),
      canManageIntegrations: vi.fn(() => true),
      canManageProjects: vi.fn(() => true),
      collectEpisodeUpdatesByVisibility,
      createRevisionToken: vi.fn(() => "revision-token"),
      deriveAniListMediaOrganization: vi.fn(),
      dispatchEditorialWebhookEvent: vi.fn(),
      enqueueProjectOgPrewarm: vi.fn(() => Promise.resolve()),
      ensureNoEditConflict: vi.fn(() => true),
      fetchAniListMediaById: vi.fn(),
      findDuplicateEpisodeKey: vi.fn(() => null),
      findDuplicateVolumeCover: vi.fn(() => null),
      findProjectChapterByEpisodeNumber: vi.fn(),
      findPublishedImageEpisodeWithoutPages: vi.fn(() => null),
      importRemoteImageFile: vi.fn(),
      isWithinRestoreWindow: vi.fn(() => true),
      localizeProjectImageFields: vi.fn(async ({ project }) => ({
        project,
        uploadsToUpsert: [],
        summary: { downloaded: 0, failed: 0 },
      })),
      loadProjects,
      loadUpdates: vi.fn(() => []),
      loadUploads: vi.fn(() => []),
      mapProjectImageImportExecutionError: vi.fn(),
      normalizeProjectSnapshotForEpubImport: vi.fn(),
      normalizeProjects: vi.fn((projects) => projects),
      parseEditRevisionOptions: vi.fn(() => ({})),
      requireAuth: vi.fn(),
      resolveEpisodeLookup: vi.fn(),
      resolveProjectWebhookEventKey: vi.fn(),
      runAutoUploadReorganization: vi.fn(() => Promise.resolve()),
      writeProjects,
      writeUpdates: vi.fn(),
      upsertUploadEntries: vi.fn(),
    });

    const updateHandler = routeState.updateHandler;
    expect(updateHandler).toBeTypeOf("function");
    if (!updateHandler) {
      throw new Error("Expected project update handler");
    }

    const response = createResponse();
    await updateHandler(
      {
        session: { user: { id: "owner-1" } },
        params: { id: "105333" },
        body: { title: "Projeto atualizado" },
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      project: {
        ...nextProject,
        revision: "revision-token",
      },
    });
    expect(collectEpisodeUpdatesByVisibility).toHaveBeenCalledWith(
      existingProject,
      expect.objectContaining({
        ...nextProject,
        updatedAt: expect.any(String),
      }),
      expect.any(String),
    );
    expect(writeProjects).toHaveBeenCalledWith([
      expect.objectContaining({
        ...nextProject,
        updatedAt: expect.any(String),
      }),
    ]);
  });
});
