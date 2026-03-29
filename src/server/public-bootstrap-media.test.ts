import { describe, expect, it } from "vitest";

import { collectBootstrapPublicMediaUrls } from "../../scripts/lib/public-bootstrap-media.mjs";

describe("collectBootstrapPublicMediaUrls", () => {
  it("coleta URLs deterministicas e deduplica uploads do bootstrap publico", () => {
    const result = collectBootstrapPublicMediaUrls(
      {
        projects: [
          {
            cover: "https://dev.nekomata.moe/uploads/projects/21878/cover.png?cache=1",
            banner: "/uploads/projects/21878/banner.png",
            heroImageUrl: "/uploads/projects/21878/hero.png",
            episodeDownloads: [
              {
                coverImageUrl: "/uploads/projects/21878/episodes/ep-1.png",
              },
              {
                coverImageUrl: "/uploads/projects/21878/episodes/ep-1.png",
              },
            ],
          },
        ],
        posts: [
          {
            coverImageUrl: "/uploads/posts/post-1.png",
          },
        ],
        pages: {
          home: {
            shareImage: "/uploads/shared/home-og.png",
          },
        },
      },
      { limit: 6 },
    );

    expect(result).toEqual([
      {
        label: "projects[0].cover",
        url: "/uploads/projects/21878/cover.png",
      },
      {
        label: "projects[0].episodeDownloads[0].coverImageUrl",
        url: "/uploads/projects/21878/episodes/ep-1.png",
      },
      {
        label: "projects[0].banner",
        url: "/uploads/projects/21878/banner.png",
      },
      {
        label: "projects[0].heroImageUrl",
        url: "/uploads/projects/21878/hero.png",
      },
      {
        label: "posts[0].coverImageUrl",
        url: "/uploads/posts/post-1.png",
      },
      {
        label: "pages.home.shareImage",
        url: "/uploads/shared/home-og.png",
      },
    ]);
  });

  it("respeita o limite informado", () => {
    const result = collectBootstrapPublicMediaUrls(
      {
        projects: [
          {
            cover: "/uploads/projects/1/cover.png",
            banner: "/uploads/projects/1/banner.png",
            heroImageUrl: "/uploads/projects/1/hero.png",
            episodeDownloads: [{ coverImageUrl: "/uploads/projects/1/episodes/1.png" }],
          },
        ],
        posts: [{ coverImageUrl: "/uploads/posts/post-1.png" }],
      },
      { limit: 2 },
    );

    expect(result).toEqual([
      { label: "projects[0].cover", url: "/uploads/projects/1/cover.png" },
      {
        label: "projects[0].episodeDownloads[0].coverImageUrl",
        url: "/uploads/projects/1/episodes/1.png",
      },
    ]);
  });

  it("prioriza covers de varios projetos antes de consumir o limite com banners e heroes", () => {
    const result = collectBootstrapPublicMediaUrls(
      {
        projects: [
          { cover: "/uploads/projects/1/cover.png", banner: "/uploads/projects/1/banner.png" },
          { cover: "/uploads/projects/2/cover.png", banner: "/uploads/projects/2/banner.png" },
          { cover: "/uploads/projects/3/cover.png", banner: "/uploads/projects/3/banner.png" },
        ],
      },
      { limit: 3 },
    );

    expect(result).toEqual([
      { label: "projects[0].cover", url: "/uploads/projects/1/cover.png" },
      { label: "projects[1].cover", url: "/uploads/projects/2/cover.png" },
      { label: "projects[2].cover", url: "/uploads/projects/3/cover.png" },
    ]);
  });

  it("prioriza a primeira capa de episodio por projeto antes de cair para banners", () => {
    const result = collectBootstrapPublicMediaUrls(
      {
        projects: [
          {
            cover: "/uploads/projects/1/cover.png",
            banner: "/uploads/projects/1/banner.png",
            episodeDownloads: [{ coverImageUrl: "/uploads/projects/1/episodes/1.png" }],
          },
          {
            cover: "/uploads/projects/2/cover.png",
            banner: "/uploads/projects/2/banner.png",
            episodeDownloads: [{ coverImageUrl: "/uploads/projects/2/episodes/1.png" }],
          },
        ],
      },
      { limit: 4 },
    );

    expect(result).toEqual([
      { label: "projects[0].cover", url: "/uploads/projects/1/cover.png" },
      { label: "projects[1].cover", url: "/uploads/projects/2/cover.png" },
      {
        label: "projects[0].episodeDownloads[0].coverImageUrl",
        url: "/uploads/projects/1/episodes/1.png",
      },
      {
        label: "projects[1].episodeDownloads[0].coverImageUrl",
        url: "/uploads/projects/2/episodes/1.png",
      },
    ]);
  });

  it("mantem cobertura de episodios quando existem muitos projetos no bootstrap", () => {
    const result = collectBootstrapPublicMediaUrls(
      {
        projects: Array.from({ length: 8 }, (_item, index) => ({
          cover: `/uploads/projects/${index}/cover.png`,
          episodeDownloads: [{ coverImageUrl: `/uploads/projects/${index}/episodes/1.png` }],
        })),
      },
      { limit: 12 },
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: "projects[5].episodeDownloads[0].coverImageUrl",
          url: "/uploads/projects/5/episodes/1.png",
        },
      ]),
    );
  });
});
