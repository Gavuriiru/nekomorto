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

    expect(preservedProject.episodeDownloads[0].chapterUpdatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("updates chapterUpdatedAt when published manga pages change", () => {
    const now = "2026-03-12T12:00:00.000Z";

    const updatedProject = applyEpisodePublicationMetadata(
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-01T00:00:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch3-v1-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
        ],
      },
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-01T00:00:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch3-v2-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
        ],
      },
      now,
    );

    expect(updatedProject.episodeDownloads[0].chapterUpdatedAt).toBe(now);
  });

  it("updates chapterUpdatedAt when published manga spread pairing changes", () => {
    const now = "2026-03-12T13:00:00.000Z";

    const updatedProject = applyEpisodePublicationMetadata(
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-01T00:00:00.000Z",
            contentFormat: "images",
            pages: [
              { position: 0, imageUrl: "/uploads/ch3-page-1.jpg" },
              { position: 1, imageUrl: "/uploads/ch3-page-2.jpg" },
            ],
            pageCount: 2,
            sources: [],
          },
        ],
      },
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-01T00:00:00.000Z",
            contentFormat: "images",
            pages: [
              { position: 0, imageUrl: "/uploads/ch3-page-1.jpg", spreadPairId: "spread-1" },
              { position: 1, imageUrl: "/uploads/ch3-page-2.jpg", spreadPairId: "spread-1" },
            ],
            pageCount: 2,
            sources: [],
          },
        ],
      },
      now,
    );

    expect(updatedProject.episodeDownloads[0].chapterUpdatedAt).toBe(now);
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
        unit: "Cap\u00edtulo",
        reason: "Conte\u00fado ajustado no cap\u00edtulo 1",
        episodeNumber: 1,
        volume: 1,
      }),
      expect.objectContaining({
        kind: "Lan\u00e7amento",
        unit: "Cap\u00edtulo",
        reason: "Cap\u00edtulo 1 dispon\u00edvel",
        episodeNumber: 1,
        volume: 2,
      }),
    ]);
  });

  it("creates launches and adjustments for published manga chapters with pages and no sources", () => {
    const updates = collectEpisodeUpdates(
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-10T10:00:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch3-v1-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
        ],
      },
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Cap 3",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-12T10:00:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch3-v2-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
          {
            number: 4,
            volume: 1,
            title: "Cap 4",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-03-12T10:05:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch4-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
        ],
      },
      "2026-03-12T10:05:00.000Z",
    ).sort((a, b) => Number(a.episodeNumber || 0) - Number(b.episodeNumber || 0));

    expect(updates).toEqual([
      expect.objectContaining({
        kind: "Ajuste",
        unit: "Cap\u00edtulo",
        reason: "Conte\u00fado ajustado no cap\u00edtulo 3",
        episodeNumber: 3,
        volume: 1,
      }),
      expect.objectContaining({
        kind: "Lan\u00e7amento",
        unit: "Cap\u00edtulo",
        reason: "Cap\u00edtulo 4 dispon\u00edvel",
        episodeNumber: 4,
        volume: 1,
      }),
    ]);
  });

  it("treats published image chapters from manga and webtoon as public even without sources", () => {
    expect(
      isEpisodePublic("Manga", {
        publicationStatus: "published",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/ch1-page-1.jpg" }],
        pageCount: 1,
        sources: [],
      }),
    ).toBe(true);

    expect(
      isEpisodePublic("Webtoon", {
        publicationStatus: "published",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/ch2-page-1.jpg" }],
        pageCount: 1,
        sources: [],
      }),
    ).toBe(true);

    expect(
      isEpisodePublic("Manga", {
        publicationStatus: "draft",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/ch1-page-1.jpg" }],
        pageCount: 1,
        sources: [],
      }),
    ).toBe(false);
  });

  it("requires a complete source for published anime entries and reader content or source for light novel", () => {
    expect(
      isEpisodePublic("Anime", {
        publicationStatus: "published",
        sources: [{ label: "Google Drive", url: "" }],
      }),
    ).toBe(false);

    expect(
      isEpisodePublic("Anime", {
        publicationStatus: "published",
        sources: [{ label: "Google Drive", url: "https://example.com/ep-1" }],
      }),
    ).toBe(true);

    expect(
      isEpisodePublic("Light Novel", {
        publicationStatus: "published",
        content: "",
        sources: [],
      }),
    ).toBe(false);

    expect(
      isEpisodePublic("Light Novel", {
        publicationStatus: "published",
        content: '{"root":{"children":[{"type":"paragraph","children":[{"text":"Conteudo"}]}]}}',
        sources: [],
      }),
    ).toBe(true);

    expect(
      isEpisodePublic("Light Novel", {
        publicationStatus: "published",
        content: "",
        sources: [{ label: "Google Drive", url: "https://example.com/cap-1" }],
      }),
    ).toBe(true);
  });

  it("keeps draft manga chapters out of updates", () => {
    const updates = collectEpisodeUpdates(
      {
        type: "Manga",
        episodeDownloads: [],
      },
      {
        type: "Manga",
        episodeDownloads: [
          {
            number: 5,
            volume: 1,
            title: "Cap 5",
            publicationStatus: "draft",
            chapterUpdatedAt: "2026-03-12T10:05:00.000Z",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/ch5-page-1.jpg" }],
            pageCount: 1,
            sources: [],
          },
        ],
      },
      "2026-03-12T10:05:00.000Z",
    );

    expect(updates).toEqual([]);
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
        kind: "Lan\u00e7amento",
        unit: "Especial",
        reason: "Especial 2 dispon\u00edvel",
        episodeNumber: 2,
      }),
    ]);
  });

  it("resolve a unidade textual por tipo e entry kind", () => {
    expect(resolveProjectUpdateUnitLabel("Especial", { number: 1 })).toBe("Especial");
    expect(resolveProjectUpdateUnitLabel("special", { number: 1 })).toBe("Especial");
    expect(resolveProjectUpdateUnitLabel("Light Novel", { number: 1 })).toBe("Cap\u00edtulo");
    expect(resolveProjectUpdateUnitLabel("Anime", { number: 1 })).toBe("Epis\u00f3dio");
    expect(resolveProjectUpdateUnitLabel("Especial", { entryKind: "extra", number: 1 })).toBe(
      "Extra",
    );
  });
});
