import { describe, expect, it } from "vitest";

import {
  buildPostOgCardModel,
  buildPostOgImagePath,
  buildPostOgImageResponse,
} from "../../server/lib/post-og.js";

const baseSettings = {
  theme: {
    accent: "#3173ff",
  },
};

const basePost = {
  id: "post-1",
  title: "Post de Teste",
  slug: "post-teste",
  author: "Admin",
  status: "published",
  coverImageUrl: "/uploads/posts/post-1/cover.jpg",
};

const artworkDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz2kAAAAASUVORK5CYII=";

describe("post og helper", () => {
  it("builds encoded image path", () => {
    expect(buildPostOgImagePath("post com espaco")).toBe("/api/og/post/post%20com%20espaco");
  });

  it("keeps eyebrow fixed as Postagem without status suffix", () => {
    const publishedModel = buildPostOgCardModel({
      post: { ...basePost, status: "published" },
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });
    const scheduledModel = buildPostOgCardModel({
      post: { ...basePost, status: "scheduled" },
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });
    const draftModel = buildPostOgCardModel({
      post: { ...basePost, status: "draft" },
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });

    expect(publishedModel.eyebrowParts).toEqual(["Postagem"]);
    expect(scheduledModel.eyebrowParts).toEqual(["Postagem"]);
    expect(draftModel.eyebrowParts).toEqual(["Postagem"]);
    expect(publishedModel.eyebrow).toBe("Postagem");
    expect(scheduledModel.eyebrow).toBe("Postagem");
  });

  it("maps subtitle from author and truncates title/subtitle", () => {
    const model = buildPostOgCardModel({
      post: {
        ...basePost,
        title: "Um titulo extremamente longo para validar truncamento no card de postagem",
        author: "Um nome de autor muito longo para validar truncamento da linha secundaria",
      },
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });

    expect(model.title.endsWith("...")).toBe(true);
    expect(model.title.length).toBeLessThanOrEqual(46);
    expect(model.subtitle.endsWith("...")).toBe(true);
    expect(model.subtitle.length).toBeLessThanOrEqual(38);
  });

  it("resolves cover image variant with og preset", () => {
    const model = buildPostOgCardModel({
      post: basePost,
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string, preset: string) => `${value}?preset=${preset}`,
    });

    expect(model.artworkUrl).toBe("/uploads/posts/post-1/cover.jpg?preset=og");
    expect(model.artworkSource).toBe("coverImageUrl");
  });

  it("falls back to default accent palette when accent is invalid", () => {
    const invalidModel = buildPostOgCardModel({
      post: basePost,
      settings: { theme: { accent: "not-a-color" } },
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });
    const defaultModel = buildPostOgCardModel({
      post: basePost,
      settings: { theme: { accent: "#9667e0" } },
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });

    expect(invalidModel.palette).toEqual(defaultModel.palette);
  });

  it("renders png via shared project renderer", async () => {
    const model = buildPostOgCardModel({
      post: basePost,
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });

    const response = buildPostOgImageResponse({
      ...model,
      artworkDataUrl,
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(buffer.length).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("renders png with long two-line title and subtitle present", async () => {
    const model = buildPostOgCardModel({
      post: {
        ...basePost,
        title: "Love Live! Superstar!! 01 - Uma historia bem longa para ocupar duas linhas",
        author: "Jose Gabriel",
      },
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });

    const response = buildPostOgImageResponse({
      ...model,
      artworkDataUrl,
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(buffer.length).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toContain("image/png");
  });
});
