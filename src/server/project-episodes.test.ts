import { describe, expect, it } from "vitest";

import {
  buildEpisodeKey,
  findDuplicateEpisodeKey,
  findPublishedEpisodeWithoutPublicAccess,
  findPublishedImageEpisodeWithoutPages,
  resolveEpisodeLookup,
  resolvePublishedEpisodeLookup,
} from "../../server/lib/project-episodes.js";

describe("project episode helpers", () => {
  it("builds stable number+volume keys and detects duplicates", () => {
    expect(buildEpisodeKey(7, 3)).toBe("7:3");
    expect(buildEpisodeKey("7", undefined)).toBe("7:0");
    expect(buildEpisodeKey("abc", 1)).toBe("");

    expect(
      findDuplicateEpisodeKey([
        { number: 1, volume: 1 },
        { number: 1, volume: 2 },
        { number: 1, volume: 1 },
      ]),
    ).toEqual({
      key: "1:1",
      firstIndex: 0,
      secondIndex: 2,
    });
  });

  it("requires volume when the same chapter number exists in multiple volumes", () => {
    const project = {
      episodeDownloads: [
        { number: 5, volume: 1, title: "Cap 5 v1", publicationStatus: "published" },
        { number: 5, volume: 2, title: "Cap 5 v2", publicationStatus: "published" },
      ],
    };

    expect(resolveEpisodeLookup(project, 5, null)).toMatchObject({
      ok: false,
      code: "volume_required",
    });

    expect(resolveEpisodeLookup(project, 5, 2)).toMatchObject({
      ok: true,
      code: "ok",
      key: "5:2",
      episode: expect.objectContaining({
        title: "Cap 5 v2",
      }),
    });
  });

  it("builds standardized published lookup results for route callers", () => {
    const project = {
      type: "Anime",
      episodeDownloads: [
        {
          number: 5,
          volume: 1,
          title: "Cap 5 v1",
          publicationStatus: "published",
          sources: [{ label: "Google Drive", url: "https://example.com/cap-5-v1" }],
        },
        {
          number: 5,
          volume: 2,
          title: "Cap 5 v2",
          publicationStatus: "published",
          sources: [{ label: "Google Drive", url: "https://example.com/cap-5-v2" }],
        },
        { number: 6, volume: 1, title: "Cap 6 v1", publicationStatus: "draft" },
      ],
    };

    expect(
      resolvePublishedEpisodeLookup(project, 5, null, {
        notFoundError: "target_not_found",
      }),
    ).toMatchObject({
      ok: false,
      code: "volume_required",
      error: "volume_required",
      statusCode: 400,
    });

    expect(
      resolvePublishedEpisodeLookup(project, 6, 1, {
        notFoundError: "target_not_found",
      }),
    ).toMatchObject({
      ok: false,
      code: "not_found",
      error: "target_not_found",
      statusCode: 404,
    });

    expect(resolvePublishedEpisodeLookup(project, 5, 2)).toMatchObject({
      ok: true,
      code: "ok",
      error: null,
      key: "5:2",
      statusCode: 200,
    });
  });

  it("detects published image chapters without pages while allowing empty drafts", () => {
    expect(
      findPublishedImageEpisodeWithoutPages([
        {
          number: 1,
          volume: 1,
          contentFormat: "images",
          pages: [],
          hasPages: false,
          publicationStatus: "draft",
        },
        {
          number: 2,
          volume: 1,
          contentFormat: "images",
          pages: [],
          hasPages: false,
          publicationStatus: "published",
        },
      ]),
    ).toMatchObject({
      key: "2:1",
      episode: expect.objectContaining({
        number: 2,
        volume: 1,
      }),
    });

    expect(
      findPublishedImageEpisodeWithoutPages([
        {
          number: 3,
          volume: 1,
          contentFormat: "images",
          pages: [{ position: 1, imageUrl: "/uploads/manga/ch3-01.jpg" }],
          hasPages: true,
          publicationStatus: "published",
        },
      ]),
    ).toBeNull();
  });

  it("detects the first published entry without real public access by project type", () => {
    expect(
      findPublishedEpisodeWithoutPublicAccess("Anime", [
        {
          number: 1,
          sources: [],
          publicationStatus: "draft",
        },
        {
          number: 2,
          sources: [{ label: "Google Drive", url: "" }],
          publicationStatus: "published",
        },
      ]),
    ).toMatchObject({
      key: "2:0",
      errorCode: "download_sources_required_for_publication",
    });

    expect(
      findPublishedEpisodeWithoutPublicAccess("Light Novel", [
        {
          number: 3,
          volume: 1,
          content: "",
          sources: [],
          publicationStatus: "published",
        },
      ]),
    ).toMatchObject({
      key: "3:1",
      errorCode: "reader_content_or_download_required_for_publication",
    });

    expect(
      findPublishedEpisodeWithoutPublicAccess("Manga", [
        {
          number: 4,
          volume: 1,
          contentFormat: "images",
          pages: [{ position: 0, imageUrl: "/uploads/manga/cap4-1.jpg" }],
          publicationStatus: "published",
          sources: [],
        },
      ]),
    ).toBeNull();
  });

  it("keeps invalid legacy published entries out of published lookup results", () => {
    const project = {
      type: "Anime",
      episodeDownloads: [
        {
          number: 1,
          publicationStatus: "published",
          sources: [],
        },
        {
          number: 2,
          publicationStatus: "published",
          sources: [{ label: "Google Drive", url: "https://example.com/ep-2" }],
        },
      ],
    };

    expect(resolvePublishedEpisodeLookup(project, 1, null)).toMatchObject({
      ok: false,
      code: "not_found",
      error: "not_found",
      statusCode: 404,
    });

    expect(resolvePublishedEpisodeLookup(project, 2, null)).toMatchObject({
      ok: true,
      key: "2:0",
      statusCode: 200,
    });
  });
});
