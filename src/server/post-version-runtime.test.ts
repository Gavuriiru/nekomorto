import { describe, expect, it, vi } from "vitest";

import { createPostVersionRuntime } from "../../server/lib/post-version-runtime.js";

const createSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createUniqueSlug = (candidate: string, existing: string[]) => {
  if (!existing.includes(candidate)) {
    return candidate;
  }
  let index = 2;
  while (existing.includes(`${candidate}-${index}`)) {
    index += 1;
  }
  return `${candidate}-${index}`;
};

const createNormalizePosts = () => (items: Array<Record<string, unknown>>) =>
  (Array.isArray(items) ? items : []).map((post, index) => {
    const title = String(post?.title || `Post ${index + 1}`);
    const id = String(post?.id || `post-${index + 1}`);
    const slug = String(post?.slug || createSlug(title) || id);
    return {
      id,
      slug,
      title,
      status: String(post?.status || "published"),
      publishedAt: String(post?.publishedAt || "2026-03-01T00:00:00.000Z"),
      scheduledAt: post?.scheduledAt || null,
      projectId: String(post?.projectId || ""),
      excerpt: String(post?.excerpt || ""),
      content: String(post?.content || ""),
      contentFormat: String(post?.contentFormat || "markdown"),
      author: String(post?.author || ""),
      coverImageUrl: post?.coverImageUrl || null,
      coverAlt: String(post?.coverAlt || ""),
      seoTitle: String(post?.seoTitle || ""),
      seoDescription: String(post?.seoDescription || ""),
      tags: Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [],
      views: Number(post?.views || 0),
      viewsDaily: post?.viewsDaily && typeof post.viewsDaily === "object" ? post.viewsDaily : {},
      commentsCount: Number(post?.commentsCount || 0),
      deletedAt: post?.deletedAt || null,
      deletedBy: post?.deletedBy || null,
      createdAt: String(post?.createdAt || "2026-03-01T00:00:00.000Z"),
      updatedAt: String(post?.updatedAt || "2026-03-01T00:00:00.000Z"),
    };
  });

const createRuntime = ({
  storedEntries = [] as any[],
  normalizePosts,
}: {
  storedEntries?: any[];
  normalizePosts?: (() => any) | undefined;
} = {}) => {
  const cache = new Map();
  let currentEntries = [...storedEntries];
  const dataRepository = {
    loadPostVersions: vi.fn(() => currentEntries),
    writePostVersions: vi.fn((entries) => {
      currentEntries = [...entries];
    }),
  };

  const runtime = createPostVersionRuntime({
    createSlug,
    createUniqueSlug,
    crypto: {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("uuid-1")
        .mockReturnValueOnce("uuid-2")
        .mockReturnValue("uuid-next"),
    },
    dataRepository,
    dedupePostVersionRecordsNewestFirst: (items: any[]) => items,
    getNormalizePosts: normalizePosts ?? (() => createNormalizePosts()),
    invalidateJsonFileCache: vi.fn((cacheKey) => {
      cache.delete(cacheKey);
    }),
    readJsonFileFromCache: vi.fn((cacheKey) => cache.get(cacheKey) || null),
    writeJsonFileToCache: vi.fn((cacheKey, value) => {
      cache.set(cacheKey, value);
    }),
  });

  return { cache, currentEntries: () => currentEntries, dataRepository, runtime };
};

describe("post-version-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createPostVersionRuntime()).toThrow(/missing required dependencies/i);
  });

  it("normalizes and prunes repository-backed post versions", () => {
    const oldCreatedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const recentCreatedAt = new Date().toISOString();
    const { currentEntries, dataRepository, runtime } = createRuntime({
      storedEntries: [
        {
          id: "legacy-1",
          postId: "post-1",
          reason: "LEGACY",
          createdAt: recentCreatedAt,
          snapshot: {
            id: "post-1",
            slug: "post-1",
            title: "Post 1",
          },
        },
        {
          id: "legacy-2",
          postId: "post-1",
          reason: "update",
          createdAt: oldCreatedAt,
          snapshot: {
            id: "post-1",
            slug: "post-1",
            title: "Post 1",
          },
        },
      ],
    });

    const versions = runtime.loadPostVersions();

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: "legacy-1",
      postId: "post-1",
      reason: "update",
    });
    expect(dataRepository.writePostVersions).toHaveBeenCalledTimes(1);
    expect(currentEntries()).toHaveLength(1);
  });

  it("appends versions, paginates, and resolves rollback slug conflicts", () => {
    const { currentEntries, runtime } = createRuntime();

    const first = runtime.appendPostVersion({
      post: { id: "post-1", slug: "alpha", title: "Alpha" },
      reason: "create",
      actor: { id: "user-1", name: "Alice" },
    });
    const second = runtime.appendPostVersion({
      post: { id: "post-1", slug: "alpha", title: "Alpha" },
      reason: "manual",
      label: "Manual checkpoint",
    });

    expect(first).toMatchObject({ versionNumber: 1, reason: "create", actorId: "user-1" });
    expect(second).toMatchObject({
      versionNumber: 2,
      reason: "manual",
      label: "Manual checkpoint",
    });
    expect(currentEntries()).toHaveLength(2);

    const firstPage = runtime.listPostVersions("post-1", { limit: 1 });
    expect(firstPage.versions).toHaveLength(1);
    expect(firstPage.versions[0].versionNumber).toBe(2);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = runtime.listPostVersions("post-1", {
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.versions).toHaveLength(1);
    expect(secondPage.versions[0].versionNumber).toBe(1);

    const rolledBack = runtime.applyPostSnapshotForRollback({
      existingPost: {
        id: "post-1",
        slug: "alpha",
        title: "Alpha",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      snapshot: {
        id: "post-1",
        slug: "beta",
        title: "Beta",
      },
      allPosts: [
        { id: "post-1", slug: "alpha", title: "Alpha" },
        { id: "post-2", slug: "beta", title: "Beta" },
      ],
    });

    expect(rolledBack).toMatchObject({
      id: "post-1",
      slug: "beta-2",
      title: "Beta",
    });
  });

  it("fails fast when the lazy normalizePosts getter does not resolve", () => {
    const { runtime } = createRuntime({
      normalizePosts: () => undefined,
    });

    expect(() =>
      runtime.appendPostVersion({
        post: { id: "post-1", slug: "alpha", title: "Alpha" },
        reason: "create",
      }),
    ).toThrow(/getNormalizePosts/);
  });
});
