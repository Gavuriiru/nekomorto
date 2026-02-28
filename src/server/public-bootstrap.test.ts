import { describe, expect, it } from "vitest";

import { buildPublicBootstrapPayload } from "../../server/lib/public-bootstrap.js";

describe("public bootstrap payload", () => {
  it("returns the expected top-level shape and strips heavy chapter content", () => {
    const payload = buildPublicBootstrapPayload({
      settings: { site: { name: "Nekomata" } },
      projects: [
        {
          id: "project-1",
          title: "Projeto",
          synopsis: "Sinopse",
          description: "Descricao",
          type: "Anime",
          status: "Em andamento",
          tags: ["acao"],
          cover: "/uploads/cover.jpg",
          coverAlt: "Capa do projeto",
          banner: "/uploads/banner.jpg",
          bannerAlt: "Banner do projeto",
          heroImageUrl: "/uploads/hero.jpg",
          heroImageAlt: "Hero do projeto",
          forceHero: true,
          trailerUrl: "https://example.com/trailer",
          deletedAt: "2026-01-01T00:00:00.000Z",
          episodeDownloads: [
            {
              number: 3,
              volume: 1,
              title: "Capitulo 3",
              content: "{\"root\":{}}",
              sources: [{ label: "Drive", url: "https://example.com/file" }],
              completedStages: ["traducao"],
              coverImageUrl: "/uploads/episode-3.jpg",
              coverImageAlt: "Capa do episodio 3",
            },
          ],
        },
      ],
      posts: [
        {
          id: "post-1",
          slug: "post-teste",
          title: "Post",
          excerpt: "Resumo",
          author: "Equipe",
          publishedAt: "2026-02-01T00:00:00.000Z",
          coverImageUrl: "/uploads/post.jpg",
          projectId: "project-1",
          tags: ["acao"],
        },
      ],
      updates: [
        {
          id: "update-1",
          projectId: "project-1",
          projectTitle: "Projeto",
          episodeNumber: 3,
          kind: "Lançamento",
          reason: "Novo episódio",
          updatedAt: "2026-02-01T00:00:00.000Z",
          image: "/uploads/cover.jpg",
          unit: "Episódio",
        },
      ],
      tagTranslations: {
        tags: { acao: "Ação" },
        genres: { drama: "Drama" },
        staffRoles: { tradutor: "Tradutor" },
      },
      generatedAt: "2026-02-10T10:00:00.000Z",
    });

    expect(payload).toEqual(
      expect.objectContaining({
        settings: expect.any(Object),
        projects: expect.any(Array),
        posts: expect.any(Array),
        updates: expect.any(Array),
        tagTranslations: expect.any(Object),
        generatedAt: "2026-02-10T10:00:00.000Z",
      }),
    );
    expect(payload.projects).toHaveLength(1);
    expect(payload.posts).toHaveLength(1);
    expect(payload.updates).toHaveLength(1);

    const project = payload.projects[0] as Record<string, unknown>;
    expect(project).not.toHaveProperty("deletedAt");
    expect(project.coverAlt).toBe("Capa do projeto");
    expect(project.bannerAlt).toBe("Banner do projeto");
    expect(project.heroImageAlt).toBe("Hero do projeto");
    expect(project.episodeDownloads).toEqual([
      expect.objectContaining({
        number: 3,
        hasContent: true,
        coverImageAlt: "Capa do episodio 3",
      }),
    ]);
    expect((project.episodeDownloads as Array<Record<string, unknown>>)[0]).not.toHaveProperty("content");
  });
});
