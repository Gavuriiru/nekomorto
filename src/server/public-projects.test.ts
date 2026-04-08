import { describe, expect, it } from "vitest";

import {
  buildPublicInProgressItems,
  buildPublicReadableProjects,
  buildPublicVisibleProjects,
} from "../../server/lib/public-projects.js";

describe("public project serialization", () => {
  it("preserves content for readable chapter-targeted payloads and strips it from list payloads", () => {
    const projects = [
      {
        id: "project-1",
        title: "Projeto",
        type: "Light Novel",
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
            sources: [{ label: "Google Drive", url: "https://example.com/cap-1" }],
          },
          {
            number: 2,
            volume: 1,
            title: "Capitulo 2",
            publicationStatus: "draft",
            content: '{"root":{"children":[{"type":"paragraph","children":[],"version":1}]}}',
            sources: [],
          },
          {
            number: 3,
            volume: 1,
            title: "Capitulo 3",
            publicationStatus: "published",
            content: "",
            sources: [{ label: "Google Drive", url: "" }],
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
        sources: [{ label: "Google Drive", url: "https://example.com/cap-1" }],
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
        sources: [{ label: "Google Drive", url: "https://example.com/cap-1" }],
      }),
    ]);
    expect(visibleProjects[0].episodeDownloads[0]).not.toHaveProperty("content");
  });

  it("filters legacy published entries without public access while keeping empty drafts in progress", () => {
    const visibleProjects = buildPublicVisibleProjects([
      {
        id: "project-anime",
        title: "Anime",
        type: "Anime",
        order: 1,
        deletedAt: null,
        episodeDownloads: [
          {
            number: 1,
            title: "Ep 1",
            publicationStatus: "published",
            sources: [],
          },
          {
            number: 2,
            title: "Ep 2",
            publicationStatus: "published",
            sources: [{ label: "Google Drive", url: "https://example.com/ep-2" }],
          },
        ],
      },
    ]);

    expect(visibleProjects[0].episodeDownloads).toEqual([
      expect.objectContaining({
        number: 2,
        sources: [{ label: "Google Drive", url: "https://example.com/ep-2" }],
      }),
    ]);

    expect(
      buildPublicInProgressItems([
        {
          id: "project-ln",
          title: "LN",
          type: "Light Novel",
          order: 1,
          deletedAt: null,
          episodeDownloads: [
            {
              number: 4,
              volume: 1,
              publicationStatus: "draft",
              content: "",
              sources: [],
              progressStage: "traducao",
              completedStages: ["aguardando-raw"],
            },
          ],
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        projectId: "project-ln",
        number: 4,
        volume: 1,
        progressStage: "traducao",
      }),
    ]);
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

  it("builds lightweight in-progress items from draft episodes without exposing heavy content", () => {
    const inProgressItems = buildPublicInProgressItems([
      {
        id: "project-anime",
        title: "Oshi no Ko",
        type: "Anime",
        order: 20,
        deletedAt: null,
        episodeDownloads: [
          {
            number: 2,
            title: "Episodio 2",
            publicationStatus: "draft",
            progressStage: "timing",
            completedStages: ["aguardando-raw", "traducao", "revisao"],
            sources: [{ label: "Drive", url: "https://example.com/file" }],
            content: '{"root":{}}',
          },
        ],
      },
      {
        id: "project-ln",
        title: "NouKin",
        type: "Light Novel",
        order: 10,
        deletedAt: null,
        episodeDownloads: [
          {
            number: 3,
            volume: 0,
            title: "Capitulo 3",
            publicationStatus: "draft",
            progressStage: "traducao",
            completedStages: ["aguardando-raw"],
            content: '{"root":{}}',
          },
        ],
      },
      {
        id: "project-published",
        title: "Blue Box",
        type: "Manga",
        order: 30,
        deletedAt: null,
        episodeDownloads: [
          {
            number: 12,
            volume: 2,
            title: "Capitulo 12",
            publicationStatus: "published",
            progressStage: "typesetting",
            completedStages: ["aguardando-raw", "traducao", "limpeza", "redrawing"],
            content: '{"root":{}}',
          },
        ],
      },
    ]);

    expect(inProgressItems).toEqual([
      {
        projectId: "project-ln",
        projectTitle: "NouKin",
        projectType: "Light Novel",
        number: 3,
        volume: 0,
        entryKind: "main",
        displayLabel: undefined,
        progressStage: "traducao",
        completedStages: ["aguardando-raw"],
      },
      {
        projectId: "project-anime",
        projectTitle: "Oshi no Ko",
        projectType: "Anime",
        number: 2,
        volume: undefined,
        entryKind: "main",
        displayLabel: undefined,
        progressStage: "timing",
        completedStages: ["aguardando-raw", "traducao", "revisao"],
      },
    ]);
  });
});
