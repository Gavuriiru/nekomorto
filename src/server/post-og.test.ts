import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { OG_PROJECT_HEIGHT, OG_PROJECT_WIDTH } from "../../server/lib/project-og.js";
import {
  buildPostOgCardModel,
  buildPostOgImagePath,
  buildPostOgImageResponse,
  buildPostOgScene,
} from "../../server/lib/post-og.js";

const transparentDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const baseSettings = {
  theme: {
    accent: "#3173ff",
  },
  site: {
    defaultShareImage: "https://cdn.example.com/default-share.png",
  },
};

const basePost = {
  id: "post-1",
  title: "Post de Teste",
  slug: "post-teste",
  author: "Admin",
  status: "published",
  tags: ["novidade", "editorial"],
  content: "<p>Conteudo</p>",
  contentFormat: "html",
};

const relatedProject = {
  id: "project-1",
  title: "Projeto Relacionado",
  genres: ["drama", "misterio"],
  tags: ["psicologico", "sobrenatural"],
  cover: "/uploads/projects/project-1/cover.jpg",
  banner: "/uploads/projects/project-1/banner.jpg",
  heroImageUrl: "/uploads/projects/project-1/hero.jpg",
};

const toArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
};

const findElement = (
  node: unknown,
  predicate: (candidate: { props?: Record<string, unknown> }) => boolean,
): { props?: Record<string, unknown> } | null => {
  if (!node || typeof node !== "object") {
    return null;
  }
  const candidate = node as { props?: Record<string, unknown> };
  if (predicate(candidate)) {
    return candidate;
  }
  const children = toArray(candidate.props?.children);
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
};

const assertRenderedPng = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.width).toBe(OG_PROJECT_WIDTH);
  expect(metadata.height).toBe(OG_PROJECT_HEIGHT);

  const stats = await sharp(buffer).ensureAlpha().stats();
  const alpha = stats.channels[3];
  expect(alpha).toBeDefined();
  expect(alpha.max).toBeGreaterThan(0);
};

const buildModel = ({
  post = {},
  resolvedCover = { coverImageUrl: "/uploads/posts/post-1/cover.jpg", source: "manual" },
  firstPostImage = { coverImageUrl: "/uploads/posts/post-1/body.jpg" },
  project = relatedProject,
  resolvedAuthor = { name: "Admin", avatarUrl: "" },
  defaultBackdropUrl = baseSettings.site.defaultShareImage,
} = {}) =>
  buildPostOgCardModel({
    post: {
      ...basePost,
      ...post,
    },
    relatedProject: project,
    resolvedCover,
    firstPostImage,
    resolvedAuthor,
    defaultBackdropUrl,
    settings: baseSettings,
    tagTranslations: {
      psicologico: "Psicologico",
      sobrenatural: "Sobrenatural",
      novidade: "Novidade",
      editorial: "Editorial",
    },
    genreTranslations: {
      drama: "Drama",
      misterio: "Misterio",
    },
    origin: "https://nekomata.moe",
    resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
  });

describe("post og helper", () => {
  it("builds encoded image path", () => {
    expect(buildPostOgImagePath("post com espaco")).toBe("/api/og/post/post%20com%20espaco");
  });

  it("builds a real card model with fixed eyebrow, author subtitle and project chips", () => {
    const model = buildModel({
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });

    expect(model.eyebrowParts).toEqual(["Postagem"]);
    expect(model.eyebrow).toBe("Postagem");
    expect(model.subtitle).toBe("Autora Teste");
    expect(model.subtitleNoWrap).toBe(true);
    expect(model.chipSource).toBe("related-project");
    expect(model.chips).toEqual(["Drama", "Misterio", "Psicologico", "Sobrenatural"]);
    expect(model.artworkSource).toBe("post-cover");
    expect(model.artworkUrl).toBe("/uploads/posts/post-1/cover.jpg?preset=poster");
    expect(model.backdropSource).toBe("post-first-image");
    expect(model.backdropUrl).toBe("/uploads/posts/post-1/body.jpg?preset=hero");
    expect(model.subtitleAvatarUrl).toBe("https://cdn.example.com/avatar.png");
    expect(model.sceneVersion).toBe("post-og-v3");
  });

  it("falls back from post cover to first post image and then project cover for artwork", () => {
    const fromFirstImage = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
    });
    const fromProjectCover = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
      firstPostImage: { coverImageUrl: "" },
    });

    expect(fromFirstImage.artworkSource).toBe("post-first-image");
    expect(fromFirstImage.artworkUrl).toBe("/uploads/posts/post-1/body.jpg?preset=hero");
    expect(fromProjectCover.artworkSource).toBe("project-cover");
    expect(fromProjectCover.artworkUrl).toBe("/uploads/projects/project-1/cover.jpg?preset=poster");
  });

  it("uses the backdrop hierarchy without ever using project heroImageUrl", () => {
    const bannerWins = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
      firstPostImage: { coverImageUrl: "" },
    });
    const coverWinsWhenBannerMissing = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
      firstPostImage: { coverImageUrl: "" },
      project: {
        ...relatedProject,
        banner: "",
      },
    });
    const defaultWinsLast = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
      firstPostImage: { coverImageUrl: "" },
      project: {
        ...relatedProject,
        cover: "",
        banner: "",
      },
    });

    expect(bannerWins.backdropSource).toBe("project-banner");
    expect(bannerWins.backdropUrl).toBe("/uploads/projects/project-1/banner.jpg?preset=hero");
    expect(coverWinsWhenBannerMissing.backdropSource).toBe("project-cover");
    expect(coverWinsWhenBannerMissing.backdropUrl).toBe(
      "/uploads/projects/project-1/cover.jpg?preset=hero",
    );
    expect(defaultWinsLast.backdropSource).toBe("site-default-share-image");
    expect(defaultWinsLast.backdropUrl).toBe(
      "https://cdn.example.com/default-share.png?preset=hero",
    );
    expect(defaultWinsLast.backdropUrl).not.toContain("hero.jpg");
  });

  it("falls back to post tags when the related project does not provide chips", () => {
    const model = buildModel({
      project: {
        ...relatedProject,
        genres: [],
        tags: [],
      },
    });

    expect(model.chipSource).toBe("post-tags");
    expect(model.chips).toEqual(["Novidade", "Editorial"]);
  });

  it("renders the author avatar only when it resolves", () => {
    const withAvatar = buildModel({
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });
    const withoutAvatar = buildModel({
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "",
      },
    });
    const withAvatarScene = buildPostOgScene(withAvatar);
    const withoutAvatarScene = buildPostOgScene(withoutAvatar);
    const avatarNode = findElement(
      withAvatarScene,
      (candidate) => candidate.props?.["data-og-part"] === "subtitle-avatar",
    );
    const avatarImageNode = toArray(avatarNode?.props?.children)[0] as
      | { props?: Record<string, unknown> }
      | undefined;

    expect(avatarNode).not.toBeNull();
    expect(avatarNode?.props?.style).toEqual(
      expect.objectContaining({
        borderRadius: 27 / 2,
        overflow: "hidden",
      }),
    );
    expect(avatarImageNode?.props?.style).toEqual(
      expect.objectContaining({
        display: "block",
        borderRadius: 27 / 2,
        objectFit: "cover",
      }),
    );
    expect(
      findElement(
        withoutAvatarScene,
        (candidate) => candidate.props?.["data-og-part"] === "subtitle-avatar",
      ),
    ).toBeNull();
  });

  it("keeps a medium author name intact and avoids locking the text box to the measured width", () => {
    const model = buildModel({
      post: {
        title: "asdfgsdaSDG",
      },
      resolvedAuthor: {
        name: "José Gabriel",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });
    const scene = buildPostOgScene(model);
    const subtitleContainer = findElement(
      scene,
      (candidate) =>
        candidate.props?.style?.left === model.layout.subtitleLeft &&
        candidate.props?.style?.top === model.subtitleTop &&
        candidate.props?.style?.display === "flex" &&
        candidate.props?.style?.gap === 8,
    );
    const subtitleTextNode = Array.isArray(subtitleContainer?.props?.children)
      ? subtitleContainer.props.children[0]
      : null;

    expect(model.subtitle).toBe("José Gabriel");
    expect(subtitleContainer).not.toBeNull();
    expect(Number(subtitleContainer?.props?.style?.width || 0)).toBeGreaterThan(
      Number(model.subtitleRenderWidth || 0),
    );
    expect(Number(subtitleContainer?.props?.style?.width || 0)).toBeLessThanOrEqual(
      Number(model.layout.subtitleMaxWidth || 0),
    );
    expect(subtitleTextNode?.props?.style?.width).toBeUndefined();
    expect(subtitleTextNode?.props?.style?.maxWidth).toBe(model.subtitleTextMaxWidth);
    expect(subtitleTextNode?.props?.style?.whiteSpace).toBe("nowrap");
    expect(subtitleTextNode?.props?.style?.textOverflow).toBe("ellipsis");
  });

  it("renders the dark artwork fallback when the post has no artwork candidate", () => {
    const model = buildModel({
      resolvedCover: { coverImageUrl: "", source: "none" },
      firstPostImage: { coverImageUrl: "" },
      project: {
        ...relatedProject,
        cover: "",
      },
    });
    const scene = buildPostOgScene(model);

    expect(model.artworkSource).toBe("none");
    expect(model.artworkUrl).toBe("");
    expect(
      findElement(scene, (candidate) => candidate.props?.["data-og-part"] === "artwork-fallback"),
    ).not.toBeNull();
    expect(
      findElement(scene, (candidate) => candidate.props?.["data-og-part"] === "artwork"),
    ).toBeNull();
  });

  it("renders a valid PNG with the shared project card renderer", async () => {
    const model = buildModel({
      resolvedAuthor: {
        name: "Autora Teste",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });
    const response = buildPostOgImageResponse({
      ...model,
      artworkDataUrl: transparentDataUrl,
      backdropDataUrl: transparentDataUrl,
      subtitleAvatarDataUrl: transparentDataUrl,
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(buffer.length).toBeGreaterThan(0);
    await assertRenderedPng(buffer);
  });
});
