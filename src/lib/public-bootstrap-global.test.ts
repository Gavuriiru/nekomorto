import { describe, expect, it } from "vitest";

import { asPublicBootstrapPayload, asPublicRoutePayload } from "@/lib/public-bootstrap-global";

describe("public bootstrap global parser", () => {
  it("preserva payloadMode critical-home quando informado", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [
        {
          projectId: "project-ln",
          projectTitle: "NouKin",
          projectType: "Light Novel",
          number: 3,
          volume: 0,
          progressStage: "traducao",
          completedStages: ["aguardando-raw"],
        },
      ],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      payloadMode: "critical-home",
    });

    expect(parsed?.payloadMode).toBe("critical-home");
    expect(parsed?.inProgressItems).toEqual([
      expect.objectContaining({
        projectTitle: "NouKin",
        volume: 0,
      }),
    ]);
  });

  it("normaliza payloadMode invalido para full", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      payloadMode: "invalid-mode",
    });

    expect(parsed?.payloadMode).toBe("full");
  });

  it("preserva payloadMode shell quando informado", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      payloadMode: "shell",
    });

    expect(parsed?.payloadMode).toBe("shell");
  });

  it("preserva e normaliza currentPostDetail quando informado", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      currentPostDetail: {
        id: "post-1",
        slug: "post-teste",
        title: "Postagem",
        excerpt: "Resumo",
        author: "Equipe",
        publishedAt: "2026-03-05T00:00:00.000Z",
        coverImageUrl: "/uploads/post.jpg",
        coverAlt: "Capa",
        projectId: "project-1",
        tags: ["acao"],
        views: 7,
        commentsCount: 3,
        content: "<p>Conteúdo</p>",
        contentFormat: "lexical",
        seoTitle: "SEO",
        seoDescription: "Descricao SEO",
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
    });

    expect(parsed?.currentPostDetail).toEqual(
      expect.objectContaining({
        slug: "post-teste",
        content: "<p>Conteúdo</p>",
        views: 7,
        commentsCount: 3,
      }),
    );
  });

  it("preserva e normaliza o payload canônico da home hero", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      homeHero: {
        initialSlideId: "project-1",
        latestSlideId: "project-1",
        hasMultipleSlides: false,
        slides: [
          {
            id: "project-1",
            title: "Projeto Hero",
            description: "Descricao",
            updatedAt: "2026-03-05T00:00:00.000Z",
            image: "/uploads/project-1-hero.jpg",
            projectId: "project-1",
            trailerUrl: "",
            format: "Anime",
            status: "Em andamento",
            heroLogoUrl: "/uploads/project-1-hero-logo.png",
            heroLogoAlt: "Marca oficial do projeto",
          },
        ],
      },
    });

    expect(parsed?.homeHero).toEqual({
      initialSlideId: "project-1",
      latestSlideId: "project-1",
      hasMultipleSlides: false,
      slides: [
        expect.objectContaining({
          id: "project-1",
          image: "/uploads/project-1-hero.jpg",
          projectId: "project-1",
          heroLogoUrl: "/uploads/project-1-hero-logo.png",
          heroLogoAlt: "Marca oficial do projeto",
        }),
      ],
    });
  });

  it("normaliza payload de rota project-detail com lookup e mediaVariants", () => {
    const parsed = asPublicRoutePayload({
      kind: "project-detail",
      generatedAt: "2026-03-05T00:00:00.000Z",
      project: {
        id: "project-1",
        title: "Projeto",
      },
      revision: "rev-1",
      relationProjectLookup: {
        "anilist:20": "project-2",
        "  ": "",
      },
      mediaVariants: {
        "/uploads/project-1.jpg": {
          variantsVersion: 1,
          variants: {},
        },
      },
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        kind: "project-detail",
        revision: "rev-1",
        relationProjectLookup: {
          "anilist:20": "project-2",
        },
        mediaVariants: {
          "/uploads/project-1.jpg": expect.objectContaining({
            variantsVersion: 1,
          }),
        },
      }),
    );
  });

  it("normaliza payload de rota donations com qrs do servidor", () => {
    const parsed = asPublicRoutePayload({
      kind: "donations",
      generatedAt: "2026-03-05T00:00:00.000Z",
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        0: "data:image/png;base64,btc",
        empty: "",
      },
    });

    expect(parsed).toEqual({
      kind: "donations",
      generatedAt: "2026-03-05T00:00:00.000Z",
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        "0": "data:image/png;base64,btc",
      },
    });
  });
});
