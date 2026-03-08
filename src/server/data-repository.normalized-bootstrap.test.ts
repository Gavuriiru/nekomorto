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

describe("DbDataRepository normalized bootstrap", () => {
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
    prismaMock.secretRotationRecord.findMany.mockClear();
  });

  it("mantem leitura legada e nao consulta normalized_runtime_state quando o schema novo nao existe", async () => {
    const repo = createRepo();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await repo.hydrate();
    } finally {
      consoleErrorSpy.mockRestore();
    }

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.normalizedRuntimeStateRecord.findMany).not.toHaveBeenCalled();
    expect(repo.normalizedSchemaAvailable).toBe(false);
    expect(repo.normalizedReadState.available).toBe(false);
    expect(repo.normalizedReadState.source).toBe("missing_schema");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
