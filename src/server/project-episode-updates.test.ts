import { describe, expect, it } from "vitest";

import {
  applyEpisodePublicationMetadata,
  collectEpisodeUpdates,
  isEpisodePublic,
  resolveProjectUpdateUnitLabel,
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
        unit: "Capítulo",
        reason: "Conteúdo ajustado no capítulo 1",
        episodeNumber: 1,
        volume: 1,
      }),
      expect.objectContaining({
        kind: "Lançamento",
        unit: "Capítulo",
        reason: "Capítulo 1 disponível",
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

  it("usa Especial como unidade propria para lancamentos e ajustes", () => {
    const updates = collectEpisodeUpdates(
      {
        type: "Especial",
        episodeDownloads: [
          {
            number: 1,
            title: "Especial 1",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-01T10:00:00.000Z",
            sources: [{ label: "Drive", url: "https://example.com/especial-1-v1" }],
          },
        ],
      },
      {
        type: "Special",
        episodeDownloads: [
          {
            number: 1,
            title: "Especial 1 revisado",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-02T10:00:00.000Z",
            sources: [{ label: "Drive", url: "https://example.com/especial-1-v2" }],
          },
          {
            number: 2,
            title: "Especial 2",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-02T11:00:00.000Z",
            sources: [{ label: "Drive", url: "https://example.com/especial-2" }],
          },
        ],
      },
      "2026-03-02T11:00:00.000Z",
    ).sort((a, b) => Number(a.episodeNumber || 0) - Number(b.episodeNumber || 0));

    expect(updates).toEqual([
      expect.objectContaining({
        kind: "Ajuste",
        unit: "Especial",
        reason: "Links ajustados no especial 1",
        episodeNumber: 1,
      }),
      expect.objectContaining({
        kind: "Lançamento",
        unit: "Especial",
        reason: "Especial 2 disponível",
        episodeNumber: 2,
      }),
    ]);
  });

  it("resolve a unidade textual por tipo e entry kind", () => {
    expect(resolveProjectUpdateUnitLabel("Especial", { number: 1 })).toBe("Especial");
    expect(resolveProjectUpdateUnitLabel("special", { number: 1 })).toBe("Especial");
    expect(resolveProjectUpdateUnitLabel("Light Novel", { number: 1 })).toBe("Capítulo");
    expect(resolveProjectUpdateUnitLabel("Anime", { number: 1 })).toBe("Episódio");
    expect(resolveProjectUpdateUnitLabel("Especial", { entryKind: "extra", number: 1 })).toBe("Extra");
  });
});
