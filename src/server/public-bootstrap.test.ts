import { describe, expect, it } from "vitest";

import { buildPublicBootstrapPayload } from "../../server/lib/public-bootstrap.js";

describe("public bootstrap payload", () => {
  it("returns the expected top-level shape and strips heavy chapter content", () => {
    const payload = buildPublicBootstrapPayload({
      settings: { site: { name: "Nekomata" } },
      pages: {
        home: {
          shareImage: "/uploads/home-og.jpg",
          shareImageAlt: "Home",
        },
      },
      projects: [
        {
          id: "project-1",
          title: "Projeto",
          titleOriginal: "Projecto Original",
          titleEnglish: "Project",
          synopsis: "Sinopse",
          description: "Descricao",
          type: "Anime",
          status: "Em andamento",
          tags: ["acao"],
          genres: ["drama"],
          cover: "/uploads/cover.jpg",
          coverAlt: "Capa do projeto",
          banner: "/uploads/banner.jpg",
          bannerAlt: "Banner do projeto",
          heroImageUrl: "/uploads/hero.jpg",
          heroImageAlt: "Hero do projeto",
          studio: "Studio Teste",
          animationStudios: ["Studio Teste"],
          episodes: "12 episodios",
          producers: ["Produtora 1"],
          volumeEntries: [
            {
              volume: 1,
              synopsis: "Sinopse do volume 1",
              coverImageUrl: "/uploads/volume-1.jpg",
              coverImageAlt: "Capa do volume 1",
            },
          ],
          volumeCovers: [
            {
              volume: 1,
              coverImageUrl: "/uploads/volume-1.jpg",
              coverImageAlt: "Capa do volume 1",
            },
          ],
          forceHero: true,
          trailerUrl: "https://example.com/trailer",
          views: -12,
          viewsDaily: {
            "2026-02-01": 3,
            "2026-02-02": "7",
            invalid: 10,
            "2026-02-03": -4,
          },
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
          volume: 1,
          kind: "Lançamento",
          reason: "Novo episódio",
          updatedAt: "2026-02-01T00:00:00.000Z",
          image: "/uploads/cover.jpg",
          unit: "Episódio",
        },
      ],
      teamMembers: [
        {
          id: "team-1",
          name: "Integrante",
          phrase: "Frase",
          bio: "Bio",
          avatarUrl: "/uploads/users/team-1.png",
          socials: [{ label: "site", href: "https://example.com/team-1" }],
          favoriteWorks: {
            manga: ["Manga A"],
            anime: ["Anime A"],
          },
          permissions: ["users.read"],
          roles: ["Membro"],
          isAdmin: false,
          status: "active",
          order: 3,
          accessRole: "normal",
        },
      ],
      teamLinkTypes: [
        {
          id: "site",
          label: "Site",
          icon: "globe",
        },
      ],
      tagTranslations: {
        tags: { acao: "Ação" },
        genres: { drama: "Drama" },
        staffRoles: { tradutor: "Tradutor" },
      },
      generatedAt: "2026-02-10T10:00:00.000Z",
      payloadMode: "critical-home",
    });

    expect(payload).toEqual(
      expect.objectContaining({
        settings: expect.any(Object),
        pages: expect.any(Object),
        projects: expect.any(Array),
        posts: expect.any(Array),
        updates: expect.any(Array),
        teamMembers: expect.any(Array),
        teamLinkTypes: expect.any(Array),
        tagTranslations: expect.any(Object),
        generatedAt: "2026-02-10T10:00:00.000Z",
        payloadMode: "critical-home",
      }),
    );
    expect(payload.projects).toHaveLength(1);
    expect(payload.posts).toHaveLength(1);
    expect(payload.updates).toHaveLength(1);
    expect(payload.teamMembers).toHaveLength(1);
    expect(payload.teamLinkTypes).toHaveLength(1);
    expect((payload.updates[0] as Record<string, unknown>).volume).toBe(1);
    expect(payload.pages).toEqual({
      home: {
        shareImage: "/uploads/home-og.jpg",
        shareImageAlt: "Home",
      },
    });

    const project = payload.projects[0] as Record<string, unknown>;
    expect(project).not.toHaveProperty("deletedAt");
    expect(project.coverAlt).toBe("Capa do projeto");
    expect(project.bannerAlt).toBe("Banner do projeto");
    expect(project.heroImageAlt).toBe("Hero do projeto");
    expect(project.titleOriginal).toBe("Projecto Original");
    expect(project.titleEnglish).toBe("Project");
    expect(project.genres).toEqual(["drama"]);
    expect(project.studio).toBe("Studio Teste");
    expect(project.animationStudios).toEqual(["Studio Teste"]);
    expect(project.episodes).toBe("12 episodios");
    expect(project.producers).toEqual(["Produtora 1"]);
    expect(project.views).toBe(0);
    expect(project.viewsDaily).toEqual({
      "2026-02-01": 3,
      "2026-02-02": 7,
      "2026-02-03": 0,
    });
    expect(project.volumeEntries).toEqual([
      expect.objectContaining({
        volume: 1,
        synopsis: "Sinopse do volume 1",
        coverImageUrl: "/uploads/volume-1.jpg",
        coverImageAlt: "Capa do volume 1",
      }),
    ]);
    expect(project.volumeCovers).toEqual([
      expect.objectContaining({
        volume: 1,
        coverImageUrl: "/uploads/volume-1.jpg",
        coverImageAlt: "Capa do volume 1",
      }),
    ]);
    expect(project.episodeDownloads).toEqual([
      expect.objectContaining({
        number: 3,
        hasContent: true,
        coverImageAlt: "Capa do episodio 3",
      }),
    ]);
    expect((project.episodeDownloads as Array<Record<string, unknown>>)[0]).not.toHaveProperty("content");
    expect(payload.teamMembers[0]).toEqual(
      expect.objectContaining({
        id: "team-1",
        name: "Integrante",
        avatarUrl: "/uploads/users/team-1.png",
        socials: [{ label: "site", href: "https://example.com/team-1" }],
        favoriteWorks: { manga: ["Manga A"], anime: ["Anime A"] },
      }),
    );
    expect(payload.teamLinkTypes[0]).toEqual({
      id: "site",
      label: "Site",
      icon: "globe",
    });
  });

  it("falls back to full payload mode when value is missing or invalid", () => {
    const withoutMode = buildPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      posts: [],
      updates: [],
      tagTranslations: {},
      generatedAt: "2026-02-10T10:00:00.000Z",
    });
    const withInvalidMode = buildPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      posts: [],
      updates: [],
      tagTranslations: {},
      generatedAt: "2026-02-10T10:00:00.000Z",
      payloadMode: "unknown",
    });

    expect(withoutMode.payloadMode).toBe("full");
    expect(withInvalidMode.payloadMode).toBe("full");
  });
});
