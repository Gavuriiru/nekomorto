import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { OG_PROJECT_HEIGHT, OG_PROJECT_WIDTH } from "../../server/lib/project-og.js";
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

const assertTransparentPng = async (buffer: Buffer) => {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.width).toBe(OG_PROJECT_WIDTH);
  expect(metadata.height).toBe(OG_PROJECT_HEIGHT);
  expect(metadata.hasAlpha).toBe(true);

  const stats = await sharp(buffer).stats();
  const alpha = stats.channels[3];
  expect(alpha).toBeDefined();
  expect(alpha.min).toBe(0);
  expect(alpha.max).toBe(0);
};

describe("post og helper", () => {
  it("builds encoded image path", () => {
    expect(buildPostOgImagePath("post com espaco")).toBe("/api/og/post/post%20com%20espaco");
  });

  it("keeps eyebrow fixed as Postagem and truncates title/subtitle", () => {
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

    expect(model.eyebrowParts).toEqual(["Postagem"]);
    expect(model.eyebrow).toBe("Postagem");
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

  it("renders a transparent PNG via post OG renderer", async () => {
    const model = buildPostOgCardModel({
      post: basePost,
      settings: baseSettings,
      resolvedCover: { coverImageUrl: basePost.coverImageUrl },
      resolveVariantUrl: (value: string) => value,
    });
    const response = buildPostOgImageResponse(model);
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toContain("image/png");
    expect(buffer.length).toBeGreaterThan(0);
    await assertTransparentPng(buffer);
  });
});
