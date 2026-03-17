import { describe, expect, it } from "vitest";

import {
  buildPublicReadableProjects,
  buildPublicVisibleProjects,
} from "../../server/lib/public-projects.js";

describe("public project serialization", () => {
  it("preserves content for readable chapter-targeted payloads and strips it from list payloads", () => {
    const projects = [
      {
        id: "project-1",
        title: "Projeto",
        order: 2,
        deletedAt: null,
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Capitulo 1",
            coverImageUrl: "/uploads/projects/project-1/episodes/chapter-1.jpg",
            coverImageAlt: "Capa do capitulo 1",
            publicationStatus: "published",
            content: '{"root":{"children":[{"type":"paragraph","children":[],"version":1}]}}',
            sources: [],
          },
          {
            number: 2,
            volume: 1,
            title: "Capitulo 2",
            publicationStatus: "draft",
            content: '{"root":{"children":[{"type":"paragraph","children":[],"version":1}]}}',
            sources: [],
          },
        ],
      },
    ];

    const readableProjects = buildPublicReadableProjects(projects);
    expect(readableProjects).toHaveLength(1);
    expect(readableProjects[0].episodeDownloads).toEqual([
      expect.objectContaining({
        number: 1,
        volume: 1,
        coverImageUrl: "/uploads/projects/project-1/episodes/chapter-1.jpg",
        coverImageAlt: "Capa do capitulo 1",
        content: expect.stringContaining('"root"'),
      }),
    ]);

    const visibleProjects = buildPublicVisibleProjects(projects);
    expect(visibleProjects).toHaveLength(1);
    expect(visibleProjects[0].episodeDownloads).toEqual([
      expect.objectContaining({
        number: 1,
        volume: 1,
        coverImageUrl: "/uploads/projects/project-1/episodes/chapter-1.jpg",
        coverImageAlt: "Capa do capitulo 1",
        hasContent: true,
      }),
    ]);
    expect(visibleProjects[0].episodeDownloads[0]).not.toHaveProperty("content");
  });

  it("sorts projects by order and excludes deleted projects", () => {
    const visibleProjects = buildPublicVisibleProjects([
      {
        id: "project-2",
        title: "Projeto 2",
        order: 20,
        deletedAt: null,
        episodeDownloads: [],
      },
      {
        id: "project-1",
        title: "Projeto 1",
        order: 10,
        deletedAt: null,
        episodeDownloads: [],
      },
      {
        id: "project-deleted",
        title: "Projeto removido",
        order: 0,
        deletedAt: "2026-03-02T00:00:00.000Z",
        episodeDownloads: [],
      },
    ]);

    expect(visibleProjects.map((project) => project.id)).toEqual(["project-1", "project-2"]);
  });
});
