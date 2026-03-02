import { describe, expect, it } from "vitest";

import {
  applyEpisodePublicationMetadata,
  collectEpisodeUpdates,
  isEpisodePublic,
} from "../../server/lib/project-episode-updates.js";

describe("project episode updates", () => {
  it("stamps chapterUpdatedAt based on public visibility changes", () => {
    const now = "2026-03-02T12:00:00.000Z";

    const publishedProject = applyEpisodePublicationMetadata(
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1",
            content: '{"root":{"children":[]}}',
            publicationStatus: "draft",
            chapterUpdatedAt: "",
            sources: [],
          },
        ],
      },
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "published",
            chapterUpdatedAt: "",
            sources: [],
          },
        ],
      },
      now,
    );

    expect(publishedProject.episodeDownloads[0].chapterUpdatedAt).toBe(now);

    const preservedProject = applyEpisodePublicationMetadata(
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "published",
            chapterUpdatedAt: "2026-02-01T00:00:00.000Z",
            sources: [],
          },
        ],
      },
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1 editado",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "draft",
            chapterUpdatedAt: "",
            sources: [],
          },
        ],
      },
      now,
    );

    expect(preservedProject.episodeDownloads[0].chapterUpdatedAt).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });

  it("creates release and adjustment updates using number+volume keys", () => {
    const updates = collectEpisodeUpdates(
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1",
            content: '{"root":{"children":[{"type":"paragraph","children":[{"text":"A"}]}]}}',
            publicationStatus: "published",
            chapterUpdatedAt: "2026-02-01T00:00:00.000Z",
            sources: [],
          },
        ],
      },
      {
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Cap 1",
            content: '{"root":{"children":[{"type":"paragraph","children":[{"text":"B"}]}]}}',
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-02T10:00:00.000Z",
            sources: [],
          },
          {
            number: 1,
            volume: 2,
            title: "Cap 1 v2",
            content: '{"root":{"children":[{"type":"paragraph","children":[{"text":"Novo"}]}]}}',
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-02T10:05:00.000Z",
            sources: [],
          },
        ],
      },
      "2026-03-02T10:05:00.000Z",
    ).sort((a, b) => (a.volume || 0) - (b.volume || 0));

    expect(updates).toEqual([
      expect.objectContaining({
        kind: "Ajuste",
        episodeNumber: 1,
        volume: 1,
      }),
      expect.objectContaining({
        kind: expect.stringMatching(/lan/i),
        episodeNumber: 1,
        volume: 2,
      }),
    ]);
  });

  it("treats only published readable/downloadable light novel chapters as public", () => {
    expect(
      isEpisodePublic("Light Novel", {
        publicationStatus: "published",
        content: "",
        sources: [{ label: "Drive", url: "https://example.com/file" }],
      }),
    ).toBe(true);

    expect(
      isEpisodePublic("Light Novel", {
        publicationStatus: "draft",
        content: '{"root":{"children":[{"type":"paragraph"}]}}',
        sources: [],
      }),
    ).toBe(false);
  });
});
