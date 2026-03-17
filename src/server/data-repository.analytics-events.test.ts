import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  analyticsEventRecord: {
    create: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
    deleteMany: vi.fn(async (args: unknown) => args),
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

const buildEvent = (id: string) => ({
  id,
  ts: "2026-03-01T12:00:00.000Z",
  day: "2026-03-01",
  eventType: "view",
  resourceType: "post",
  resourceId: `post-${id}`,
  visitorHash: "anonymous",
  referrerHost: "(direct)",
  isAuthenticated: false,
  utm: { source: "", medium: "", campaign: "" },
  meta: {},
});

describe("DbDataRepository analytics events append", () => {
  beforeEach(() => {
    prismaMock.analyticsEventRecord.create.mockClear();
    prismaMock.analyticsEventRecord.createMany.mockClear();
    prismaMock.analyticsEventRecord.deleteMany.mockClear();
    prismaMock.$transaction.mockClear();
  });

  it("faz append incremental sem reescrever toda a tabela", async () => {
    const repo = createRepo();

    repo.appendAnalyticsEventEntry(buildEvent("evt-1"));
    await repo.persistQueue;

    expect(repo.loadAnalyticsEvents()).toEqual([
      expect.objectContaining({
        id: "evt-1",
        resourceId: "post-evt-1",
      }),
    ]);
    expect(prismaMock.analyticsEventRecord.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.analyticsEventRecord.createMany).not.toHaveBeenCalled();
    expect(prismaMock.analyticsEventRecord.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("incrementa posicao com base no contador interno atual", async () => {
    const repo = createRepo();
    repo.snapshot.analyticsEvents = [buildEvent("evt-existing")];
    repo.analyticsEventNextPosition = 7;

    repo.appendAnalyticsEventEntry(buildEvent("evt-2"));
    await repo.persistQueue;

    expect(prismaMock.analyticsEventRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "evt-2",
          position: 7,
        }),
      }),
    );
    expect(repo.analyticsEventNextPosition).toBe(8);
  });

  it("reseta contador no rewrite completo e continua appendando no proximo indice", async () => {
    const repo = createRepo();

    repo.writeAnalyticsEvents([buildEvent("evt-a"), buildEvent("evt-b")]);
    await repo.persistQueue;
    expect(repo.analyticsEventNextPosition).toBe(2);

    prismaMock.analyticsEventRecord.create.mockClear();
    repo.appendAnalyticsEventEntry(buildEvent("evt-c"));
    await repo.persistQueue;

    expect(prismaMock.analyticsEventRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "evt-c",
          position: 2,
        }),
      }),
    );
  });

  it("mantem append em modo fire-and-forget quando persistencia falha", async () => {
    const repo = createRepo();
    prismaMock.analyticsEventRecord.create.mockImplementationOnce(async () => {
      throw new Error("db_fail");
    });

    expect(() => repo.appendAnalyticsEventEntry(buildEvent("evt-fail"))).not.toThrow();
    await repo.persistQueue;

    expect(repo.health.lastPersistErrorLabel).toBe("analytics_event_append");
    expect(String(repo.health.lastPersistErrorMessage || "")).toContain("db_fail");
  });
});
