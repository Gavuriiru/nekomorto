import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  uploadRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  uploadV2Record: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  updateV2Record: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  updateRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  userRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  userV2Record: {
    deleteMany: vi.fn(async (args: unknown) => args),
    upsert: vi.fn(async (args: unknown) => args),
  },
  userSocialLinkRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
  },
  userRoleRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
  },
  userPermissionRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
  },
  userFavoriteWorkRecord: {
    deleteMany: vi.fn(async (args: unknown) => args),
    createMany: vi.fn(async (args: unknown) => args),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
}));

vi.mock("../../server/lib/prisma-client.js", () => ({
  prisma: prismaMock,
}));

import { DbDataRepository } from "../../server/lib/data-repository.js";

const createRepo = (overrides: Record<string, unknown> = {}) =>
  Object.assign(
    new DbDataRepository({
      ownerIdsFallback: [],
      analyticsSchemaVersion: 1,
      analyticsRetentionDays: 30,
      analyticsAggRetentionDays: 30,
      ...overrides,
    }),
    { normalizedSchemaAvailable: true },
  );

describe("DbDataRepository normalized dual-write", () => {
  beforeEach(() => {
    prismaMock.uploadRecord.deleteMany.mockClear();
    prismaMock.uploadRecord.upsert.mockClear();
    prismaMock.uploadV2Record.deleteMany.mockClear();
    prismaMock.uploadV2Record.upsert.mockClear();
    prismaMock.updateV2Record.deleteMany.mockClear();
    prismaMock.updateV2Record.upsert.mockClear();
    prismaMock.updateRecord.deleteMany.mockClear();
    prismaMock.updateRecord.upsert.mockClear();
    prismaMock.userRecord.deleteMany.mockClear();
    prismaMock.userRecord.upsert.mockClear();
    prismaMock.userV2Record.deleteMany.mockClear();
    prismaMock.userV2Record.upsert.mockClear();
    prismaMock.userSocialLinkRecord.deleteMany.mockClear();
    prismaMock.userSocialLinkRecord.createMany.mockClear();
    prismaMock.userRoleRecord.deleteMany.mockClear();
    prismaMock.userRoleRecord.createMany.mockClear();
    prismaMock.userPermissionRecord.deleteMany.mockClear();
    prismaMock.userPermissionRecord.createMany.mockClear();
    prismaMock.userFavoriteWorkRecord.deleteMany.mockClear();
    prismaMock.userFavoriteWorkRecord.createMany.mockClear();
    prismaMock.$transaction.mockClear();
  });

  it("faz upsert incremental na tabela uploads_v2 apenas para entradas alteradas", async () => {
    const repo = createRepo();
    repo.snapshot.uploads = [
      {
        id: "upload-1",
        url: "/uploads/a.jpg",
        fileName: "a.jpg",
        folder: "posts",
        mime: "image/jpeg",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "upload-2",
        url: "/uploads/b.jpg",
        fileName: "b.jpg",
        folder: "posts",
        mime: "image/jpeg",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    repo.writeUploads([
      {
        id: "upload-1",
        url: "/uploads/a.jpg",
        fileName: "a.jpg",
        folder: "posts",
        mime: "image/jpeg",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "upload-2",
        url: "/uploads/b.jpg",
        fileName: "b.jpg",
        folder: "posts/featured",
        mime: "image/jpeg",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);

    await repo.persistQueue;

    expect(prismaMock.uploadV2Record.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.uploadV2Record.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "upload-2" },
        create: expect.objectContaining({
          folder: "posts/featured",
          storageProvider: "local",
        }),
      }),
    );
    expect(prismaMock.uploadV2Record.deleteMany).not.toHaveBeenCalled();
  });

  it("nulifica hashSha256 duplicado no lote para respeitar a constraint unica", async () => {
    const repo = createRepo();

    repo.writeUploads([
      {
        id: "upload-1",
        url: "/uploads/a.jpg",
        fileName: "a.jpg",
        folder: "posts",
        mime: "image/jpeg",
        hashSha256: "dup-hash",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "upload-2",
        url: "/uploads/b.jpg",
        fileName: "b.jpg",
        folder: "posts",
        mime: "image/jpeg",
        hashSha256: "dup-hash",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);

    await repo.persistQueue;

    expect(prismaMock.uploadV2Record.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.uploadV2Record.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          id: "upload-1",
          hashSha256: "dup-hash",
          storageProvider: "local",
        }),
      }),
    );
    expect(prismaMock.uploadV2Record.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          id: "upload-2",
          hashSha256: null,
          storageProvider: "local",
        }),
      }),
    );
  });

  it("quarentena updates com projectId orfao antes de tocar updates_v2", async () => {
    const repo = createRepo();
    repo.snapshot.projects = [{ id: "project-1", title: "Projeto 1" }];

    repo.writeUpdates([
      {
        id: "update-1",
        projectId: "missing-project",
        projectTitle: "Projeto perdido",
        episodeNumber: "1",
        kind: "release",
        reason: "new_episode",
        unit: "episode",
        image: "",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);

    await repo.persistQueue;

    expect(prismaMock.updateV2Record.upsert).not.toHaveBeenCalled();
    expect(repo.health.lastPersistErrorLabel).toBe("updates_v2_quarantine");
    expect(String(repo.health.lastPersistErrorMessage || "")).toContain("quarantined=1");
  });

  it("faz upsert incremental em users_v2 e recria apenas as tabelas-filhas do usuario alterado", async () => {
    const repo = createRepo();
    repo.snapshot.users = [
      {
        id: "user-1",
        name: "Alice",
        phrase: "",
        bio: "",
        avatarUrl: null,
        socials: [{ label: "Discord", href: "https://discord.gg/a" }],
        favoriteWorks: { anime: ["A"], manga: [] },
        status: "active",
        permissions: ["posts"],
        roles: ["Editor"],
        avatarDisplay: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
        accessRole: "admin",
        order: 0,
      },
      {
        id: "user-2",
        name: "Bob",
        phrase: "",
        bio: "",
        avatarUrl: null,
        socials: [],
        favoriteWorks: { anime: [], manga: [] },
        status: "active",
        permissions: [],
        roles: [],
        avatarDisplay: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
        accessRole: "normal",
        order: 1,
      },
    ];

    repo.writeUsers([
      {
        id: "user-1",
        name: "Alice",
        phrase: "updated",
        bio: "",
        avatarUrl: null,
        socials: [{ label: "Discord", href: "https://discord.gg/a" }],
        favoriteWorks: { anime: ["A"], manga: [] },
        status: "active",
        permissions: ["posts", "analytics"],
        roles: ["Editor"],
        avatarDisplay: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
        accessRole: "admin",
        order: 0,
      },
      {
        id: "user-2",
        name: "Bob",
        phrase: "",
        bio: "",
        avatarUrl: null,
        socials: [],
        favoriteWorks: { anime: [], manga: [] },
        status: "active",
        permissions: [],
        roles: [],
        avatarDisplay: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
        accessRole: "normal",
        order: 1,
      },
    ]);

    await repo.persistQueue;

    expect(prismaMock.userV2Record.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.userV2Record.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        create: expect.objectContaining({
          phrase: "updated",
        }),
      }),
    );
    expect(prismaMock.userPermissionRecord.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.userPermissionRecord.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.userPermissionRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ permission: "posts" }),
          expect.objectContaining({ permission: "analytics" }),
        ]),
      }),
    );
    expect(prismaMock.userV2Record.deleteMany).not.toHaveBeenCalled();
  });
});
