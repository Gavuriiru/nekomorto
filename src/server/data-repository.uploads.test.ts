import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  uploadRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  $transaction: vi.fn(async (operations: unknown[]) =>
    Promise.all(operations as Promise<unknown>[]),
  ),
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

describe("DbDataRepository uploads persistence", () => {
  beforeEach(() => {
    prismaMock.uploadRecord.deleteMany.mockClear();
    prismaMock.uploadRecord.upsert.mockClear();
    prismaMock.$transaction.mockClear();
  });

  it("mantem modo fire-and-forget por padrao sem propagar erro", async () => {
    const repo = createRepo();
    prismaMock.uploadRecord.upsert.mockImplementationOnce(async () => {
      throw new Error("db_fail");
    });

    expect(() =>
      repo.writeUploads([
        {
          id: "upload-1",
          url: "/uploads/tmp/a.jpg",
          folder: "tmp",
          createdAt: "2026-03-03T00:00:00.000Z",
        },
      ]),
    ).not.toThrow();

    await repo.persistQueue;
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("propaga erro quando awaitPersist=true", async () => {
    const repo = createRepo();
    prismaMock.uploadRecord.upsert.mockImplementationOnce(async () => {
      throw new Error("db_fail");
    });

    await expect(
      repo.writeUploads(
        [
          {
            id: "upload-1",
            url: "/uploads/tmp/a.jpg",
            folder: "tmp",
            createdAt: "2026-03-03T00:00:00.000Z",
          },
        ],
        { awaitPersist: true },
      ),
    ).rejects.toThrow("db_fail");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
