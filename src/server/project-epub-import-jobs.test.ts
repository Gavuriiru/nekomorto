import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  EPUB_IMPORT_JOB_RESULT_TTL_MS,
  deleteEpubImportJobResult,
  normalizeEpubImportJobStatus,
  readEpubImportJobResult,
  toEpubImportJobApiResponse,
  writeEpubImportJobResult,
} from "../../server/lib/project-epub-import-jobs.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const nextDir = tempDirs.pop();
    if (nextDir && fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
  }
});

const createTempDir = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nekomorto-epub-import-jobs-"));
  tempDirs.push(tempDir);
  return tempDir;
};

describe("project-epub-import-jobs", () => {
  it("normaliza status desconhecido para queued", () => {
    expect(normalizeEpubImportJobStatus("completed")).toBe("completed");
    expect(normalizeEpubImportJobStatus("FAILED")).toBe("failed");
    expect(normalizeEpubImportJobStatus("")).toBe("queued");
    expect(normalizeEpubImportJobStatus("unknown")).toBe("queued");
  });

  it("grava, le e remove o resultado do job", () => {
    const jobsDir = createTempDir();
    const result = {
      chapters: [{ number: 1, title: "Chapter 1" }],
      summary: { chapters: 1 },
    };

    const resultPath = writeEpubImportJobResult({
      jobsDir,
      jobId: "job-1",
      result,
    });

    expect(resultPath).toBe(path.join(jobsDir, "job-1.json"));
    expect(readEpubImportJobResult(resultPath)).toEqual(result);
    expect(deleteEpubImportJobResult(resultPath)).toBe(true);
    expect(readEpubImportJobResult(resultPath)).toBeNull();
  });

  it("monta a resposta publica do job com timestamps, status e result opcionais", () => {
    const createdAt = "2026-03-09T12:00:00.000Z";
    const expiresAt = new Date(Date.parse(createdAt) + EPUB_IMPORT_JOB_RESULT_TTL_MS).toISOString();
    const result = {
      chapters: [{ number: 3 }],
      summary: { chapters: 1 },
    };

    expect(
      toEpubImportJobApiResponse(
        {
          id: "job-1",
          projectId: "project-1",
          requestedBy: "user-1",
          status: "COMPLETED",
          summary: { chapters: 1 },
          error: null,
          resultPath: "D:/tmp/job-1.json",
          createdAt,
          startedAt: createdAt,
          finishedAt: createdAt,
          expiresAt,
        },
        { result },
      ),
    ).toEqual({
      id: "job-1",
      projectId: "project-1",
      requestedBy: "user-1",
      status: "completed",
      summary: { chapters: 1 },
      error: null,
      createdAt,
      startedAt: createdAt,
      finishedAt: createdAt,
      expiresAt,
      hasResult: true,
      result,
    });
  });
});
