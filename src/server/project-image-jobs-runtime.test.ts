import { describe, expect, it, vi } from "vitest";

import { createProjectImageJobsRuntime } from "../../server/lib/project-image-jobs-runtime.js";

const createDeps = (overrides = {}) => {
  let importJobs = [
    {
      id: "import-job-1",
      requestedBy: "user-1",
      status: "queued",
      resultPath: null,
    },
  ];
  let exportJobs = [
    {
      id: "export-job-1",
      requestedBy: "user-1",
      status: "queued",
      resultPath: null,
    },
  ];

  return {
    backgroundJobQueue: {
      enqueue: vi.fn(async (job) => job.run()),
    },
    deleteProjectImageExportJobResult: vi.fn(),
    deleteProjectImageImportJobResult: vi.fn(),
    ensureProjectImageExportJobsDirectory: vi.fn(() => "tmp-project-image-export-jobs"),
    exportProjectImageCollection: vi.fn(() => ({
      filename: "volume-1.zip",
      contentType: "application/zip",
      buffer: Buffer.from("zip-data"),
      summary: { files: 3 },
    })),
    fsWriteFileSync: vi.fn(),
    importProjectImageChapters: vi.fn(async () => ({
      summary: { createdChapters: 4 },
    })),
    loadProjectImageExportJobs: () => exportJobs,
    loadProjectImageImportJobs: () => importJobs,
    loadUploads: () => [],
    mapProjectImageImportExecutionError: (error) => ({
      body: { detail: String(error?.message || error || "import_failed") },
    }),
    pathBasename: (value) => String(value || "").split(/[\\/]/).pop(),
    pathJoin: (...parts) => parts.join("/"),
    projectImageExportJobsDir: "tmp-project-image-export-jobs",
    projectImageExportResultTtlMs: 60_000,
    projectImageImportJobsDir: "tmp-project-image-import-jobs",
    projectImageImportResultTtlMs: 60_000,
    publicUploadsDir: "public/uploads",
    upsertProjectImageExportJob: vi.fn((job) => {
      exportJobs = [...exportJobs.filter((entry) => entry.id !== job.id), job];
      return job;
    }),
    upsertProjectImageImportJob: vi.fn((job) => {
      importJobs = [...importJobs.filter((entry) => entry.id !== job.id), job];
      return job;
    }),
    writeProjectImageImportJobResult: vi.fn(() => "tmp-project-image-import-jobs/import-job-1.json"),
    writeUploads: vi.fn(),
    ...overrides,
  };
};

describe("project-image-jobs-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createProjectImageJobsRuntime()).toThrow(/missing required dependencies/i);
  });

  it("runs import and export jobs through the queue", async () => {
    const deps = createDeps();
    const runtime = createProjectImageJobsRuntime(deps);

    const importResult = await runtime.enqueueProjectImageImportJob("import-job-1", {
      project: { id: "project-1" },
      targetVolume: 2,
      targetChapterNumber: 12,
    });
    const exportResult = await runtime.enqueueProjectImageExportJob("export-job-1", {
      project: { id: "project-1" },
      volume: 2,
      includeDrafts: true,
    });

    expect(deps.backgroundJobQueue.enqueue).toHaveBeenCalledTimes(2);
    expect(importResult).toEqual(
      expect.objectContaining({
        id: "import-job-1",
        status: "completed",
        summary: { createdChapters: 4 },
      }),
    );
    expect(exportResult).toEqual(
      expect.objectContaining({
        id: "export-job-1",
        status: "completed",
        summary: expect.objectContaining({
          files: 3,
          filename: "volume-1.zip",
          contentType: "application/zip",
        }),
      }),
    );
    expect(runtime.buildProjectImageExportDownloadPath("project-1", "export-job-1")).toBe(
      "/api/projects/project-1/manga-export/jobs/export-job-1/download",
    );
  });

  it("expires finished jobs and recovers interrupted jobs after restart", () => {
    const deps = createDeps({
      loadProjectImageImportJobs: () => [
        {
          id: "expired-import",
          requestedBy: "user-1",
          status: "completed",
          resultPath: "tmp-project-image-import-jobs/expired-import.json",
          expiresAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "queued-import",
          requestedBy: "user-1",
          status: "queued",
          resultPath: null,
        },
      ],
      loadProjectImageExportJobs: () => [
        {
          id: "expired-export",
          requestedBy: "user-1",
          status: "completed",
          resultPath: "tmp-project-image-export-jobs/expired-export.zip",
          expiresAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "queued-export",
          requestedBy: "user-1",
          status: "processing",
          resultPath: null,
        },
      ],
    });
    const runtime = createProjectImageJobsRuntime(deps);

    expect(runtime.findProjectImageImportJobForUser("expired-import", "user-1")).toEqual(
      expect.objectContaining({
        id: "expired-import",
      }),
    );
    expect(runtime.findProjectImageExportJobForUser("expired-export", "user-1")).toEqual(
      expect.objectContaining({
        id: "expired-export",
      }),
    );

    runtime.recoverProjectImageJobsAfterRestart();

    expect(deps.deleteProjectImageImportJobResult).toHaveBeenCalledWith(
      "tmp-project-image-import-jobs/expired-import.json",
    );
    expect(deps.deleteProjectImageExportJobResult).toHaveBeenCalledWith(
      "tmp-project-image-export-jobs/expired-export.zip",
    );
    expect(deps.upsertProjectImageImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "queued-import",
        status: "failed",
      }),
    );
    expect(deps.upsertProjectImageExportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "queued-export",
        status: "failed",
      }),
    );
  });
});
