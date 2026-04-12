import { describe, expect, it, vi } from "vitest";

import { createDataRepositoryContentRuntime } from "../../server/lib/data-repository-content-runtime.js";

const createRepository = () => ({
  loadComments: vi.fn(() => [
    { id: "comment-post", targetType: "post", targetId: "post-1" },
    {
      id: "comment-chapter",
      targetType: "chapter",
      targetId: "project-1",
      targetMeta: { chapterNumber: 1, volume: 1 },
    },
    { id: "comment-invalid", targetType: "project", targetId: "missing-project" },
  ]),
  loadPosts: vi.fn(() => [
    { id: "post-1", slug: "post-1", projectId: "project-1" },
    { id: "post-2", slug: "post-2", projectId: "missing-project" },
    { id: "post-3", slug: "post-3", deletedAt: "2026-03-01T00:00:00.000Z" },
  ]),
  loadProjects: vi.fn(() => [
    { id: "project-1", title: "Project 1" },
    { id: "project-2", title: "Project 2", deletedAt: "2026-03-01T00:00:00.000Z" },
  ]),
  loadUpdates: vi.fn(() => [
    { id: "update-1", projectId: "project-1" },
    { id: "update-2", projectId: "missing-project" },
  ]),
  loadUploads: vi.fn(() => [{ id: "upload-1", url: "/uploads/a.png" }]),
  writeComments: vi.fn(),
  writePosts: vi.fn(),
  writeProjects: vi.fn(),
  writeUpdates: vi.fn(),
  writeUploads: vi.fn(),
});

describe("data-repository-content-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createDataRepositoryContentRuntime()).toThrow(/missing required dependencies/i);
  });

  it("normalizes repository-backed content collections and invalidates caches", () => {
    const dataRepository = createRepository();
    const invalidateJsonFileCache = vi.fn();
    const invalidatePublicReadCacheTags = vi.fn();
    const readJsonFileFromCache = vi.fn(() => null);
    const writeJsonFileToCache = vi.fn();
    const normalizePosts = vi.fn((items) =>
      items.map((item) => ({
        ...item,
        normalized: true,
      })),
    );
    const normalizeProjects = vi.fn((items) =>
      items.map((item) => ({
        ...item,
        normalized: true,
      })),
    );
    const pruneExpiredDeleted = vi.fn((items) => items.filter((item) => !item.deletedAt));

    const runtime = createDataRepositoryContentRuntime({
      dataRepository,
      getNormalizePosts: () => normalizePosts,
      getNormalizeProjects: () => normalizeProjects,
      getPruneExpiredDeleted: () => pruneExpiredDeleted,
      invalidateJsonFileCache,
      invalidatePublicReadCacheTags,
      normalizeLegacyUpdateRecord: (update) => ({
        ...update,
        normalizedUpdate: true,
      }),
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
        SEARCH: "search",
        POSTS: "posts",
        PROJECTS: "projects",
      },
      readJsonFileFromCache,
      readUploadStorageProvider: () => "s3",
      resolveEpisodeLookup: () => ({ ok: true }),
      writeJsonFileToCache,
    });

    expect(runtime.loadProjects()).toEqual([
      { id: "project-1", title: "Project 1", normalized: true },
    ]);
    expect(dataRepository.writeProjects).toHaveBeenCalledWith([
      { id: "project-1", title: "Project 1" },
    ]);
    expect(runtime.loadPosts()).toEqual([
      { id: "post-1", slug: "post-1", projectId: "project-1", normalized: true },
      { id: "post-2", slug: "post-2", projectId: "missing-project", normalized: true },
    ]);
    expect(dataRepository.writePosts).toHaveBeenCalledWith([
      { id: "post-1", slug: "post-1", projectId: "project-1", normalized: true },
      { id: "post-2", slug: "post-2", projectId: "", normalized: true },
    ]);
    expect(runtime.loadUpdates()).toEqual([
      { id: "update-1", projectId: "project-1", normalizedUpdate: true },
      { id: "update-2", projectId: "missing-project", normalizedUpdate: true },
    ]);
    runtime.writeUpdates(runtime.loadUpdates());
    expect(dataRepository.writeUpdates).toHaveBeenCalledWith([
      { id: "update-1", projectId: "project-1", normalizedUpdate: true },
    ]);
    expect(runtime.loadComments()).toHaveLength(3);
    runtime.writeComments(dataRepository.loadComments());
    expect(dataRepository.writeComments).toHaveBeenCalledWith([
      { id: "comment-post", targetType: "post", targetId: "post-1" },
      {
        id: "comment-chapter",
        targetType: "chapter",
        targetId: "project-1",
        targetMeta: { chapterNumber: 1, volume: 1 },
      },
    ]);
    expect(runtime.loadUploads()).toEqual([
      { id: "upload-1", url: "/uploads/a.png", storageProvider: "s3" },
    ]);
    runtime.writeUploads([{ id: "upload-2" }]);
    expect(dataRepository.writeUploads).toHaveBeenCalledWith([{ id: "upload-2" }], {});
    expect(writeJsonFileToCache).toHaveBeenCalledWith("projects", [
      { id: "project-1", title: "Project 1", normalized: true },
    ]);
    expect(invalidatePublicReadCacheTags).toHaveBeenCalled();
    expect(invalidateJsonFileCache).toHaveBeenCalled();
  });

  it("returns safe fallbacks when repository methods are unavailable", async () => {
    const runtime = createDataRepositoryContentRuntime({
      dataRepository: {},
      getNormalizePosts: () => (value) => value,
      getNormalizeProjects: () => (value) => value,
      getPruneExpiredDeleted: () => (value) => value,
      invalidateJsonFileCache: vi.fn(),
      invalidatePublicReadCacheTags: vi.fn(),
      normalizeLegacyUpdateRecord: (value) => value,
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
        SEARCH: "search",
        POSTS: "posts",
        PROJECTS: "projects",
      },
      readJsonFileFromCache: () => null,
      readUploadStorageProvider: () => "local",
      resolveEpisodeLookup: () => ({ ok: false }),
      writeJsonFileToCache: vi.fn(),
    });

    expect(runtime.loadPosts()).toEqual([]);
    expect(runtime.loadProjects()).toEqual([]);
    expect(runtime.loadUpdates()).toEqual([]);
    expect(runtime.loadComments()).toEqual([]);
    expect(runtime.loadUploads()).toEqual([]);
    await expect(runtime.writeUploads([], { awaitPersist: true })).resolves.toBeUndefined();
  });

  it("fails fast when a lazy normalizer is unresolved", () => {
    const runtime = createDataRepositoryContentRuntime({
      dataRepository: {
        loadPosts: () => [{ id: "post-1" }],
      },
      getNormalizePosts: () => undefined,
      getNormalizeProjects: () => (value) => value,
      getPruneExpiredDeleted: () => (value) => value,
      invalidateJsonFileCache: vi.fn(),
      invalidatePublicReadCacheTags: vi.fn(),
      normalizeLegacyUpdateRecord: (value) => value,
      normalizeUploadsDeep: (value) => value,
      publicReadCacheTags: {
        BOOTSTRAP: "bootstrap",
        SEARCH: "search",
        POSTS: "posts",
        PROJECTS: "projects",
      },
      readJsonFileFromCache: () => null,
      readUploadStorageProvider: () => "local",
      resolveEpisodeLookup: () => ({ ok: false }),
      writeJsonFileToCache: vi.fn(),
    });

    expect(() => runtime.loadPosts()).toThrow(/getNormalizePosts/);
  });
});
