import { describe, expect, it } from "vitest";

import {
  buildPostVersionEditorialDedupKey,
  dedupePostVersionRecordsNewestFirst,
} from "../../server/lib/post-version-dedupe.js";

const createVersion = (overrides = {}) => {
  const snapshot = {
    id: "post-1",
    slug: "post-1",
    title: "Post 1",
    status: "published",
    publishedAt: "2026-02-26T10:00:00.000Z",
    scheduledAt: null,
    projectId: "",
    excerpt: "Resumo",
    content: "Conteúdo",
    contentFormat: "lexical",
    author: "Admin",
    coverImageUrl: null,
    coverAlt: "",
    seoTitle: "",
    seoDescription: "",
    tags: ["acao", "aventura"],
    updatedAt: "2026-02-26T10:00:00.000Z",
    ...(overrides.snapshot || {}),
  };

  return {
    id: "version-1",
    postId: "post-1",
    versionNumber: 1,
    reason: "update",
    label: null,
    actorId: null,
    actorName: "Admin",
    slug: snapshot.slug,
    createdAt: "2026-02-26T10:00:00.000Z",
    snapshot,
    ...overrides,
    snapshot: {
      ...snapshot,
      ...(overrides.snapshot || {}),
    },
  };
};

describe("post version dedupe helper", () => {
  it("gera a mesma chave para snapshots editoriais iguais ignorando metadata e updatedAt", () => {
    const first = createVersion({
      id: "v1",
      versionNumber: 1,
      reason: "update",
      createdAt: "2026-02-26T10:00:00.000Z",
      snapshot: { updatedAt: "2026-02-26T10:00:00.000Z" },
    });
    const second = createVersion({
      id: "v2",
      versionNumber: 2,
      reason: "manual",
      actorName: "Outro",
      createdAt: "2026-02-26T11:00:00.000Z",
      snapshot: { updatedAt: "2026-02-26T11:00:00.000Z" },
    });

    expect(buildPostVersionEditorialDedupKey(first)).toBe(buildPostVersionEditorialDedupKey(second));
  });

  it("remove duplicatas do mesmo post mantendo somente a mais recente (lista newest-first)", () => {
    const newest = createVersion({
      id: "v3",
      versionNumber: 3,
      createdAt: "2026-02-26T12:00:00.000Z",
      reason: "rollback",
      snapshot: { updatedAt: "2026-02-26T12:00:00.000Z" },
    });
    const duplicateOlder = createVersion({
      id: "v2",
      versionNumber: 2,
      createdAt: "2026-02-26T11:00:00.000Z",
      reason: "update",
      snapshot: { updatedAt: "2026-02-26T11:00:00.000Z" },
    });
    const distinctOlder = createVersion({
      id: "v1",
      versionNumber: 1,
      createdAt: "2026-02-26T10:00:00.000Z",
      snapshot: { excerpt: "Resumo antigo" },
    });

    const deduped = dedupePostVersionRecordsNewestFirst([newest, duplicateOlder, distinctOlder]);

    expect(deduped.map((item) => item.id)).toEqual(["v3", "v1"]);
  });

  it("não deduplica versões idênticas entre posts diferentes", () => {
    const post1 = createVersion({
      id: "p1-v2",
      postId: "post-1",
      snapshot: { id: "post-1", slug: "post-1", title: "Post 1" },
    });
    const post2 = createVersion({
      id: "p2-v1",
      postId: "post-2",
      snapshot: { id: "post-2", slug: "post-2", title: "Post 1" },
      slug: "post-2",
    });

    const deduped = dedupePostVersionRecordsNewestFirst([post1, post2]);

    expect(deduped.map((item) => item.id)).toEqual(["p1-v2", "p2-v1"]);
  });

  it("mantém versões quando há diferença editorial real (ex.: tags em ordem diferente)", () => {
    const newest = createVersion({
      id: "v2",
      versionNumber: 2,
      snapshot: { tags: ["acao", "aventura"] },
    });
    const olderDifferentOrder = createVersion({
      id: "v1",
      versionNumber: 1,
      createdAt: "2026-02-26T09:00:00.000Z",
      snapshot: { tags: ["aventura", "acao"] },
    });

    const deduped = dedupePostVersionRecordsNewestFirst([newest, olderDifferentOrder]);

    expect(deduped.map((item) => item.id)).toEqual(["v2", "v1"]);
  });
});

