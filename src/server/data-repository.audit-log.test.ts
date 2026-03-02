import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  auditLogRecord: {
    create: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
    deleteMany: vi.fn(async (args: unknown) => args),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
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

describe("DbDataRepository audit log append", () => {
  beforeEach(() => {
    prismaMock.auditLogRecord.create.mockClear();
    prismaMock.auditLogRecord.createMany.mockClear();
    prismaMock.auditLogRecord.deleteMany.mockClear();
    prismaMock.$transaction.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("faz append incremental sem reescrever toda a tabela", async () => {
    const repo = createRepo();

    repo.appendAuditLogEntry({
      id: "audit-1",
      ts: "2026-03-01T12:00:00.000Z",
      action: "integrations.webhooks_editorial.read",
      resource: "integrations",
    });

    await repo.persistQueue;

    expect(repo.loadAuditLog()).toEqual([
      expect.objectContaining({
        id: "audit-1",
        action: "integrations.webhooks_editorial.read",
        resource: "integrations",
      }),
    ]);
    expect(prismaMock.auditLogRecord.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLogRecord.createMany).not.toHaveBeenCalled();
    expect(prismaMock.auditLogRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("descarta itens expirados e excedentes ao fazer append incremental", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    const repo = createRepo({
      auditRetentionMs: 1_000,
      auditMaxEntries: 2,
    });

    repo.snapshot.auditLog = [
      {
        id: "expired",
        ts: "2026-03-01T11:59:58.000Z",
        action: "old",
        resource: "integrations",
      },
      {
        id: "keep-a",
        ts: "2026-03-01T11:59:59.500Z",
        action: "keep",
        resource: "integrations",
      },
      {
        id: "keep-b",
        ts: "2026-03-01T11:59:59.800Z",
        action: "keep",
        resource: "integrations",
      },
    ];
    repo.auditLogNextPosition = 7;

    repo.appendAuditLogEntry({
      id: "fresh",
      ts: "2026-03-01T12:00:00.000Z",
      action: "integrations.webhooks_editorial.read",
      resource: "integrations",
    });

    await repo.persistQueue;

    expect(repo.loadAuditLog().map((entry: { id: string }) => entry.id)).toEqual(["keep-b", "fresh"]);
    expect(prismaMock.auditLogRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "fresh",
          position: 7,
        }),
      }),
    );
    expect(prismaMock.auditLogRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["expired", "keep-a"],
        },
      },
    });
  });
});
