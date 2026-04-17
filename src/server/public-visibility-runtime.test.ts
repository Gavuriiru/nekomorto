import { describe, expect, it } from "vitest";

import {
  createPublicVisibilityRuntime,
  PUBLIC_STATIC_PATHS,
} from "../../server/lib/public-visibility-runtime.js";

const createDeps = (overrides = {}) => ({
  buildPublicReadableProjects: (projects) => projects.filter((project) => project.readable),
  buildPublicVisibleProjects: (projects) => projects.filter((project) => project.visible),
  isEpisodePublic: (type, episode) => Boolean(episode?.isPublic),
  loadPosts: () => [
    {
      id: "post-1",
      slug: "hello",
      status: "published",
      publishedAt: "2026-03-28T10:00:00.000Z",
    },
    {
      id: "post-2",
      slug: "future",
      status: "scheduled",
      publishedAt: "2099-01-01T00:00:00.000Z",
    },
  ],
  loadProjects: () => [
    {
      id: "project-1",
      readable: true,
      visible: true,
      deletedAt: null,
      type: "manga",
    },
    {
      id: "project-2",
      readable: true,
      visible: false,
      deletedAt: null,
      type: "manga",
    },
  ],
  loadUpdates: () => [
    {
      id: "update-1",
      projectId: "project-1",
      episodeNumber: 1,
      updatedAt: "2026-03-28T12:00:00.000Z",
      kind: "Lançamento",
      reason: "Novo link adicionado no capitulo 1",
    },
    {
      id: "update-2",
      projectId: "project-2",
      episodeNumber: 1,
      updatedAt: "2026-03-28T11:00:00.000Z",
    },
  ],
  normalizePosts: (posts) => posts,
  normalizeProjects: (projects) => projects,
  resolveEpisodeLookup: (project) => ({
    ok: project.id === "project-1",
    episode: { isPublic: project.id === "project-1" },
  }),
  ...overrides,
});

describe("public-visibility-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createPublicVisibilityRuntime()).toThrow(/missing required dependencies/i);
  });

  it("exposes static public paths", () => {
    expect(PUBLIC_STATIC_PATHS).toEqual([
      "/",
      "/projetos",
      "/sobre",
      "/equipe",
      "/faq",
      "/recrutamento",
      "/doacoes",
    ]);
  });

  it("derives public projects, posts, and updates from normalized sources", () => {
    const runtime = createPublicVisibilityRuntime(createDeps());

    expect(runtime.getPublicReadableProjects()).toEqual([
      expect.objectContaining({ id: "project-1" }),
      expect.objectContaining({ id: "project-2" }),
    ]);
    expect(runtime.getPublicVisibleProjects()).toEqual([
      expect.objectContaining({ id: "project-1" }),
    ]);
    expect(runtime.getPublicVisiblePosts()).toEqual([expect.objectContaining({ id: "post-1" })]);
    expect(runtime.getPublicVisibleUpdates()).toEqual([
      expect.objectContaining({
        id: "update-1",
        kind: "Ajuste",
      }),
    ]);
  });
});
