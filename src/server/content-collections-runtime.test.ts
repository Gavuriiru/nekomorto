import { describe, expect, it, vi } from "vitest";

import { createContentCollectionsRuntime } from "../../server/lib/content-collections-runtime.js";

const createDependencies = () => {
  const postsStore = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      views: 2,
      viewsDaily: {},
      commentsCount: 0,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  const projectsStore = [
    {
      id: "project-1",
      title: "Project One",
      views: 4,
      viewsDaily: {},
      commentsCount: 0,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      episodeDownloads: [
        {
          number: 1,
          title: "Episode 1",
          pages: [{ imageUrl: "/uploads/project-1/ep-1.png" }],
        },
      ],
    },
  ];

  const writePosts = vi.fn((value) => {
    postsStore.splice(0, postsStore.length, ...(Array.isArray(value) ? value : []));
  });
  const writeProjects = vi.fn((value) => {
    projectsStore.splice(0, projectsStore.length, ...(Array.isArray(value) ? value : []));
  });

  return {
    postsStore,
    projectsStore,
    writePosts,
    writeProjects,
    dependencies: {
      createSlug: (value: unknown) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      getLoadPosts: () => () => postsStore,
      getLoadProjects: () => () => projectsStore,
      getProjectEpisodePageCount: ({ pages }: { pages?: Array<unknown> }) =>
        Array.isArray(pages) ? pages.length : 0,
      getWritePosts: () => writePosts,
      getWriteProjects: () => writeProjects,
      normalizeProjectEpisodeContentFormat: (value: unknown, fallback: string) =>
        String(value || "").trim() || fallback,
      normalizeProjectEpisodePages: (pages: unknown) => (Array.isArray(pages) ? pages : []),
      normalizeProjectReaderConfig: (value: unknown, options: { projectType?: string }) => ({
        ...(value && typeof value === "object" ? (value as Record<string, unknown>) : {}),
        projectType: options.projectType || "",
      }),
      normalizeUploadsDeep: (value: unknown) => value,
      resolvePostStatus: (status: unknown) => String(status || "published"),
    },
  };
};

describe("content-collections-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createContentCollectionsRuntime()).toThrow(/missing required dependencies/i);
  });

  it("normalizes posts and projects consistently", () => {
    const { dependencies } = createDependencies();
    const runtime = createContentCollectionsRuntime(dependencies);

    expect(
      runtime.normalizePosts([
        {
          id: "post-1",
          title: "Hello World",
          excerpt: "Intro",
          author: "Alice",
          tags: ["news"],
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "post-1",
        slug: "hello-world",
        title: "Hello World",
        status: "published",
        searchText: "hello world intro alice news",
      }),
    ]);

    expect(runtime.normalizeProjects(dependencies.getLoadProjects()())).toEqual([
      expect.objectContaining({
        id: "project-1",
        title: "Project One",
        readerConfig: { projectType: "" },
        episodeDownloads: [
          expect.objectContaining({
            pageCount: 1,
            hasPages: true,
            coverImageUrl: "/uploads/project-1/ep-1.png",
          }),
        ],
      }),
    ]);
  });

  it("increments views and applies approved comment counts", () => {
    const { dependencies, postsStore, projectsStore, writePosts, writeProjects } = createDependencies();
    const runtime = createContentCollectionsRuntime(dependencies);

    const nextPost = runtime.incrementPostViews("hello-world");
    const nextProject = runtime.incrementProjectViews("project-1");

    expect(nextPost).toMatchObject({ views: 3 });
    expect(nextProject).toMatchObject({ views: 5 });
    expect(writePosts).toHaveBeenCalledTimes(1);
    expect(writeProjects).toHaveBeenCalledTimes(1);

    const postCommentsApplied = runtime.applyCommentCountToPosts(postsStore, [
      { status: "approved", targetType: "post", targetId: "hello-world" },
      { status: "pending", targetType: "post", targetId: "hello-world" },
    ], "hello-world");
    const projectCommentsApplied = runtime.applyCommentCountToProjects(projectsStore, [
      { status: "approved", targetType: "project", targetId: "project-1" },
      { status: "approved", targetType: "project", targetId: "project-1" },
    ], "project-1");

    expect(postCommentsApplied[0]).toMatchObject({ commentsCount: 1 });
    expect(projectCommentsApplied[0]).toMatchObject({ commentsCount: 2 });
  });

  it("fails fast when lazy load/write getters are unresolved", () => {
    const { dependencies } = createDependencies();
    const runtime = createContentCollectionsRuntime({
      ...dependencies,
      getLoadPosts: () => undefined,
    });

    expect(() => runtime.incrementPostViews("hello-world")).toThrow(/getLoadPosts/);
  });
});
