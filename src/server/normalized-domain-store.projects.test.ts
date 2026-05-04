import { describe, expect, it, vi } from "vitest";

import {
  loadProjectsFromNormalized,
  syncProjectsToNormalized,
} from "../../server/lib/normalized-domain-store.js";

describe("project normalized-domain-store round-trip", () => {
  it("preserva animationStudios ao serializar e reidratar projetos", async () => {
    const storedRows: Array<Record<string, any>> = [];
    const db = {
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
      projectV2Record: {
        upsert: vi.fn(async ({ create }) => {
          const index = storedRows.findIndex((row) => row.id === create.id);
          if (index >= 0) {
            storedRows[index] = create;
          } else {
            storedRows.push(create);
          }
          return create;
        }),
        deleteMany: vi.fn(async ({ where }) => {
          const index = storedRows.findIndex((row) => row.id === where.id);
          if (index >= 0) {
            storedRows.splice(index, 1);
          }
          return { count: index >= 0 ? 1 : 0 };
        }),
        findMany: vi.fn(async () =>
          [...storedRows].sort((left, right) => left.position - right.position),
        ),
      },
    };

    await syncProjectsToNormalized(
      db,
      [],
      [
        {
          id: "project-1",
          anilistId: 21878,
          title: "Teste",
          synopsis: "Sinopse",
          description: "Sinopse",
          type: "Anime",
          status: "Em andamento",
          year: "2026",
          studio: "Doga Kobo",
          animationStudios: ["Doga Kobo"],
          episodes: "12",
          tags: ["slice of life"],
          genres: ["Comedia"],
          cover: "",
          coverAlt: "",
          banner: "",
          bannerAlt: "",
          season: "",
          schedule: "",
          rating: "",
          country: "JP",
          source: "MANGA",
          discordRoleId: "",
          producers: ["Kadokawa Media House"],
          score: 84,
          startDate: "",
          endDate: "",
          relations: [],
          staff: [],
          animeStaff: [],
          trailerUrl: "",
          forceHero: false,
          heroImageUrl: "",
          heroImageAlt: "",
          heroLogoUrl: "/uploads/projects/project-1/hero-logo.png",
          heroLogoAlt: "Marca oficial do projeto",
          volumeEntries: [],
          volumeCovers: [],
          episodeDownloads: [],
          views: 0,
          viewsDaily: {},
          commentsCount: 0,
          order: 0,
          deletedAt: null,
          deletedBy: null,
          createdAt: "2026-03-12T12:00:00.000Z",
          updatedAt: "2026-03-12T12:00:00.000Z",
        },
      ],
    );

    const projects = await loadProjectsFromNormalized(db);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(
      expect.objectContaining({
        id: "project-1",
        studio: "Doga Kobo",
        animationStudios: ["Doga Kobo"],
        producers: ["Kadokawa Media House"],
        heroLogoUrl: "/uploads/projects/project-1/hero-logo.png",
        heroLogoAlt: "Marca oficial do projeto",
      }),
    );
  });
});
