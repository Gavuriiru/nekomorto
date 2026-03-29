import { describe, expect, it, vi } from "vitest";

import { createProjectImportRequestRuntime } from "../../server/lib/project-import-request-runtime.js";

const createDeps = (overrides = {}) => {
  const singleMiddleware = vi.fn((req, res, next) => next());
  const fieldsMiddleware = vi.fn((req, res, next) => next());
  const rawMiddleware = vi.fn((req, res, next) => next());
  const multerMock = vi.fn(() => ({
    single: vi.fn(() => singleMiddleware),
    fields: vi.fn(() => fieldsMiddleware),
  }));
  multerMock.memoryStorage = vi.fn(() => "memory-storage");

  return {
    EPUB_IMPORT_MULTIPART_LIMITS: {
      fileSize: 64,
      fieldSize: 32,
      files: 1,
      fields: 8,
    },
    PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS: {
      files: 24,
    },
    express: {
      raw: vi.fn(() => rawMiddleware),
    },
    findDuplicateEpisodeKey: vi.fn(() => null),
    findDuplicateVolumeCover: vi.fn(() => null),
    mapEpubImportMultipartError: vi.fn(() => ({
      status: 400,
      body: { error: "invalid_multipart_upload" },
    })),
    mapProjectImageImportMultipartError: vi.fn(() => ({
      status: 400,
      body: { error: "invalid_project_image_upload" },
    })),
    multer: multerMock,
    normalizeProjects: vi.fn((projects) => projects),
    ...overrides,
  };
};

describe("project-import-request-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createProjectImportRequestRuntime()).toThrow(
      /missing required dependencies/i,
    );
  });

  it("normalizes valid project snapshots and resolves multipart request input", () => {
    const deps = createDeps();
    const runtime = createProjectImportRequestRuntime(deps);

    const project = runtime.normalizeProjectSnapshotForEpubImport(
      JSON.stringify({
        id: "project-1",
        episodeDownloads: [],
        volumeEntries: [],
      }),
    );
    const requestInput = runtime.resolveEpubImportRequestInput({
      headers: {
        "content-type": "multipart/form-data; boundary=abc",
      },
      query: {
        projectId: "project-1",
      },
      body: {
        targetVolume: ["3"],
        defaultStatus: ["published"],
        project: JSON.stringify({
          id: "project-1",
          episodeDownloads: [],
          volumeEntries: [],
        }),
      },
      file: {
        buffer: Buffer.from("epub"),
      },
    });

    expect(project).toEqual(
      expect.objectContaining({
        id: "project-1",
      }),
    );
    expect(requestInput).toEqual(
      expect.objectContaining({
        isMultipartRequest: true,
        rawProjectId: "project-1",
        targetVolume: 3,
        defaultStatus: "published",
        buffer: Buffer.from("epub"),
      }),
    );
  });

  it("routes multipart parser errors through stable mappers", () => {
    const deps = createDeps();
    const runtime = createProjectImportRequestRuntime(deps);
    const req = {
      headers: {
        "content-type": "multipart/form-data",
      },
    };
    const res = {
      status: vi.fn(() => ({
        json: vi.fn((body) => body),
      })),
    };

    deps.multer.mockImplementationOnce(() => ({
      single: vi.fn(() => (request, response, next) =>
        next({
          code: "LIMIT_FILE_SIZE",
        }),
      ),
      fields: vi.fn(() => (request, response, next) => next()),
    }));

    const runtimeWithEpubError = createProjectImportRequestRuntime(deps);
    runtimeWithEpubError.parseEpubImportRequestBody(req, res, vi.fn());
    expect(deps.mapEpubImportMultipartError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LIMIT_FILE_SIZE" }),
    );

    const projectImageDeps = createDeps({
      multer: Object.assign(
        vi.fn(() => ({
          single: vi.fn(() => (request, response, next) => next()),
          fields: vi.fn(() => (request, response, next) =>
            next({
              code: "LIMIT_UNEXPECTED_FILE",
            }),
          ),
        })),
        { memoryStorage: vi.fn(() => "memory-storage") },
      ),
    });
    const projectImageRuntime = createProjectImportRequestRuntime(projectImageDeps);
    projectImageRuntime.parseProjectImageImportRequestBody(req, res, vi.fn());
    expect(projectImageDeps.mapProjectImageImportMultipartError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LIMIT_UNEXPECTED_FILE" }),
    );
  });
});
