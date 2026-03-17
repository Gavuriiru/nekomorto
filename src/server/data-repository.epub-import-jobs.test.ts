import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => [{ table_name: null }]),
  normalizedRuntimeStateRecord: {
    findMany: vi.fn(async () => []),
  },
  ownerIdRecord: {
    findMany: vi.fn(async () => []),
  },
  auditLogRecord: {
    findMany: vi.fn(async () => []),
  },
  analyticsEventRecord: {
    findMany: vi.fn(async () => []),
  },
  analyticsDailyRecord: {
    findUnique: vi.fn(async () => null),
  },
  analyticsMetaRecord: {
    findUnique: vi.fn(async () => null),
  },
  allowedUserRecord: {
    findMany: vi.fn(async () => []),
  },
  userRecord: {
    findMany: vi.fn(async () => []),
  },
  linkTypeRecord: {
    findMany: vi.fn(async () => []),
  },
  postRecord: {
    findMany: vi.fn(async () => []),
  },
  postVersionRecord: {
    findMany: vi.fn(async () => []),
  },
  projectRecord: {
    findMany: vi.fn(async () => []),
  },
  updateRecord: {
    findMany: vi.fn(async () => []),
  },
  tagTranslationsRecord: {
    findUnique: vi.fn(async () => null),
  },
  commentRecord: {
    findMany: vi.fn(async () => []),
  },
  uploadRecord: {
    findMany: vi.fn(async () => []),
  },
  pagesRecord: {
    findUnique: vi.fn(async () => null),
  },
  siteSettingsRecord: {
    findUnique: vi.fn(async () => null),
  },
  integrationSettingsRecord: {
    findUnique: vi.fn(async () => null),
  },
  userPreferenceRecord: {
    findMany: vi.fn(async () => []),
  },
  userMfaTotpRecord: {
    findMany: vi.fn(async () => []),
  },
  userSessionIndexRecord: {
    findMany: vi.fn(async () => []),
  },
  securityEventRecord: {
    findMany: vi.fn(async () => []),
  },
  adminExportJobRecord: {
    findMany: vi.fn(async () => []),
  },
  epubImportJobRecord: {
    findMany: vi.fn(async () => []),
    upsert: vi.fn(async (args: unknown) => args),
  },
  secretRotationRecord: {
    findMany: vi.fn(async () => []),
  },
}));

vi.mock("../../server/lib/prisma-client.js", () => ({
  prisma: prismaMock,
}));

import { DbDataRepository } from "../../server/lib/data-repository.js";

const createRepo = (overrides: Record<string, unknown> = {}) =>
  new DbDataRepository({
    ownerIdsFallback: [],
    analyticsSchemaVersion: 1,
    analyticsRetentionDays: 30,
    analyticsAggRetentionDays: 30,
    ...overrides,
  });

const createMissingEpubJobsTableError = () => ({
  code: "P2021",
  meta: {
    modelName: "EpubImportJobRecord",
    driverAdapterError: {
      cause: {
        kind: "TableDoesNotExist",
        table: "public.epub_import_jobs",
      },
    },
  },
});

describe("DbDataRepository EPUB import jobs fallback", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockClear();
    prismaMock.normalizedRuntimeStateRecord.findMany.mockClear();
    prismaMock.ownerIdRecord.findMany.mockClear();
    prismaMock.auditLogRecord.findMany.mockClear();
    prismaMock.analyticsEventRecord.findMany.mockClear();
    prismaMock.analyticsDailyRecord.findUnique.mockClear();
    prismaMock.analyticsMetaRecord.findUnique.mockClear();
    prismaMock.allowedUserRecord.findMany.mockClear();
    prismaMock.userRecord.findMany.mockClear();
    prismaMock.linkTypeRecord.findMany.mockClear();
    prismaMock.postRecord.findMany.mockClear();
    prismaMock.postVersionRecord.findMany.mockClear();
    prismaMock.projectRecord.findMany.mockClear();
    prismaMock.updateRecord.findMany.mockClear();
    prismaMock.tagTranslationsRecord.findUnique.mockClear();
    prismaMock.commentRecord.findMany.mockClear();
    prismaMock.uploadRecord.findMany.mockClear();
    prismaMock.pagesRecord.findUnique.mockClear();
    prismaMock.siteSettingsRecord.findUnique.mockClear();
    prismaMock.integrationSettingsRecord.findUnique.mockClear();
    prismaMock.userPreferenceRecord.findMany.mockClear();
    prismaMock.userMfaTotpRecord.findMany.mockClear();
    prismaMock.userSessionIndexRecord.findMany.mockClear();
    prismaMock.securityEventRecord.findMany.mockClear();
    prismaMock.adminExportJobRecord.findMany.mockClear();
    prismaMock.epubImportJobRecord.findMany.mockReset();
    prismaMock.epubImportJobRecord.findMany.mockResolvedValue([]);
    prismaMock.epubImportJobRecord.upsert.mockClear();
    prismaMock.secretRotationRecord.findMany.mockClear();
  });

  it("desabilita jobs EPUB quando a tabela ainda nao existe", async () => {
    const repo = createRepo();
    prismaMock.epubImportJobRecord.findMany.mockRejectedValueOnce(
      createMissingEpubJobsTableError(),
    );
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await expect(repo.hydrate()).resolves.toBeUndefined();
      expect(repo.loadEpubImportJobs()).toEqual([]);
      expect(repo.isEpubImportJobStorageAvailable()).toBe(false);
      expect(prismaMock.epubImportJobRecord.findMany).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[data-repository:epub_import_jobs] table missing; async EPUB import disabled until migrations run.",
      );

      expect(
        repo.upsertEpubImportJob({
          id: "job-1",
          projectId: "project-1",
          requestedBy: "user-1",
          status: "queued",
          createdAt: "2026-03-09T12:00:00.000Z",
        }),
      ).toBeNull();
      expect(prismaMock.epubImportJobRecord.upsert).not.toHaveBeenCalled();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
