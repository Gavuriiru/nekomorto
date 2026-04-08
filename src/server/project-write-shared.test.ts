import { describe, expect, it, vi } from "vitest";

import { prepareLocalizedProjectMutation } from "../../server/routes/project/write/shared.js";

const createMutationDeps = () => ({
  PUBLIC_UPLOADS_DIR: "/uploads",
  findDuplicateEpisodeKey: vi.fn(() => null),
  findDuplicateVolumeCover: vi.fn(() => null),
  importRemoteImageFile: vi.fn(),
  localizeProjectImageFields: vi.fn(async ({ project }) => ({
    project,
    uploadsToUpsert: [],
    summary: { downloaded: 0, failed: 0 },
  })),
  normalizeProjects: vi.fn((projects) => projects),
  upsertUploadEntries: vi.fn(),
});

describe("prepareLocalizedProjectMutation", () => {
  it("blocks published anime entries without a complete download source", async () => {
    const result = await prepareLocalizedProjectMutation({
      ...createMutationDeps(),
      project: {
        id: "project-anime",
        type: "Anime",
        episodeDownloads: [
          {
            number: 1,
            publicationStatus: "published",
            sources: [],
          },
        ],
      },
      requirePublicContentForPublication: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        error: "download_sources_required_for_publication",
        key: "1:0",
      },
    });
  });

  it("blocks published light novel chapters without reader content and without sources", async () => {
    const result = await prepareLocalizedProjectMutation({
      ...createMutationDeps(),
      project: {
        id: "project-ln",
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 2,
            volume: 1,
            publicationStatus: "published",
            content: "",
            sources: [],
          },
        ],
      },
      requirePublicContentForPublication: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        error: "reader_content_or_download_required_for_publication",
        key: "2:1",
      },
    });
  });

  it("allows published light novel chapters with content and manga/webtoon chapters with pages or sources", async () => {
    const lightNovelResult = await prepareLocalizedProjectMutation({
      ...createMutationDeps(),
      project: {
        id: "project-ln",
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            publicationStatus: "published",
            content:
              '{"root":{"children":[{"type":"paragraph","children":[{"text":"Conteudo"}]}]}}',
            sources: [],
          },
        ],
      },
      requirePublicContentForPublication: true,
    });

    expect(lightNovelResult).toMatchObject({
      ok: true,
      project: expect.objectContaining({
        id: "project-ln",
      }),
    });

    const mangaPagesResult = await prepareLocalizedProjectMutation({
      ...createMutationDeps(),
      project: {
        id: "project-manga",
        type: "Manga",
        episodeDownloads: [
          {
            number: 4,
            volume: 1,
            publicationStatus: "published",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/manga/cap4-1.jpg" }],
            sources: [],
          },
        ],
      },
      requirePublicContentForPublication: true,
    });

    expect(mangaPagesResult).toMatchObject({
      ok: true,
      project: expect.objectContaining({
        id: "project-manga",
      }),
    });

    const webtoonSourceResult = await prepareLocalizedProjectMutation({
      ...createMutationDeps(),
      project: {
        id: "project-webtoon",
        type: "Webtoon",
        episodeDownloads: [
          {
            number: 5,
            volume: 1,
            publicationStatus: "published",
            contentFormat: "images",
            pages: [],
            sources: [{ label: "Google Drive", url: "https://example.com/cap-5" }],
          },
        ],
      },
      requirePublicContentForPublication: true,
    });

    expect(webtoonSourceResult).toMatchObject({
      ok: true,
      project: expect.objectContaining({
        id: "project-webtoon",
      }),
    });
  });
});
