import { describe, expect, it, vi } from "vitest";

import { createProjectEpubImportRuntime } from "../../server/lib/project-epub-import-runtime.js";

const createDeps = (overrides = {}) => {
  let jobs = [
    {
      id: "job-1",
      requestedBy: "user-1",
      status: "queued",
      resultPath: null,
    },
  ];

  return {
    backgroundJobQueue: {
      enqueue: vi.fn(async (job) => job.run()),
    },
    deleteEpubImportJobResult: vi.fn(),
    epubImportJobsDir: "tmp-epub-jobs",
    epubImportResultTtlMs: 60_000,
    importProjectEpub: vi.fn(async () => ({
      summary: { createdChapters: 2 },
    })),
    loadEpubImportJobs: () => jobs,
    loadUploads: () => [],
    mapEpubImportExecutionError: (error) => ({
      body: { detail: String(error?.message || error || "failed") },
    }),
    publicUploadsDir: "public/uploads",
    upsertEpubImportJob: vi.fn((job) => {
      jobs = [...jobs.filter((entry) => entry.id !== job.id), job];
      return job;
    }),
    writeEpubImportJobResult: vi.fn(() => "tmp-epub-jobs/job-1.json"),
    writeUploads: vi.fn(),
    ...overrides,
  };
};

describe("project-epub-import-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createProjectEpubImportRuntime()).toThrow(
      /missing required dependencies/i,
    );
  });

  it("runs EPUB jobs through the queue and persists the completed result", async () => {
    const deps = createDeps();
    const runtime = createProjectEpubImportRuntime(deps);

    const result = await runtime.enqueueEpubImportJob("job-1", {
      rawProjectId: "project-1",
      targetVolume: 3,
      buffer: Buffer.from("epub"),
    });

    expect(deps.backgroundJobQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "project.epub_import",
        payload: {
          jobId: "job-1",
          projectId: "project-1",
          targetVolume: 3,
        },
      }),
    );
    expect(deps.writeEpubImportJobResult).toHaveBeenCalledWith(
      expect.objectContaining({
        jobsDir: "tmp-epub-jobs",
        jobId: "job-1",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: "job-1",
        status: "completed",
        resultPath: "tmp-epub-jobs/job-1.json",
        summary: { createdChapters: 2 },
      }),
    );
  });

  it("finds jobs by actor, expires completed results, and recovers interrupted jobs", () => {
    const deps = createDeps({
      loadEpubImportJobs: () => [
        {
          id: "expired-job",
          requestedBy: "user-1",
          status: "completed",
          resultPath: "tmp-epub-jobs/expired-job.json",
          expiresAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "queued-job",
          requestedBy: "user-2",
          status: "queued",
          resultPath: null,
        },
      ],
    });
    const runtime = createProjectEpubImportRuntime(deps);

    expect(runtime.findEpubImportJobForUser("expired-job", "user-1")).toEqual(
      expect.objectContaining({
        id: "expired-job",
      }),
    );

    const expired = runtime.expireEpubImportJob({
      id: "manual-expire",
      status: "completed",
      resultPath: "tmp-epub-jobs/manual-expire.json",
    });
    expect(expired).toEqual(
      expect.objectContaining({
        id: "manual-expire",
        status: "expired",
        resultPath: null,
      }),
    );

    runtime.recoverEpubImportJobsAfterRestart();

    expect(deps.deleteEpubImportJobResult).toHaveBeenCalledWith(
      "tmp-epub-jobs/expired-job.json",
    );
    expect(deps.upsertEpubImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "queued-job",
        status: "failed",
        error: expect.stringContaining("servidor reiniciou"),
      }),
    );
  });
});
