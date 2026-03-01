import { describe, expect, it } from "vitest";

import {
  normalizeUploadVariantUrlKey,
  resolveUploadVariantFocalPoint,
  resolveUploadVariantUrl,
  resolveUploadVariantSources,
  type UploadMediaVariantsMap,
} from "@/lib/upload-variants";

describe("upload-variants", () => {
  it("normaliza URL de upload removendo query/hash", () => {
    expect(normalizeUploadVariantUrlKey("/uploads/posts/capa.png?cache=1#v")).toBe(
      "/uploads/posts/capa.png",
    );
  });

  it("resolve fontes avif/webp/fallback por preset", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          card: {
            formats: {
              avif: { url: "/uploads/_variants/u1/card-v1.avif" },
              webp: { url: "/uploads/_variants/u1/card-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/card-v1.jpeg" },
            },
          },
        },
      },
    };
    const resolved = resolveUploadVariantSources({
      src: "https://dev.nekomata.moe/uploads/posts/capa.png?cache=2",
      preset: "card",
      mediaVariants,
    });
    expect(resolved).toEqual({
      avif: "/uploads/_variants/u1/card-v1.avif",
      webp: "/uploads/_variants/u1/card-v1.webp",
      fallback: "/uploads/_variants/u1/card-v1.jpeg",
    });
  });

  it("retorna vazio quando nao ha preset/metadata", () => {
    const resolved = resolveUploadVariantSources({
      src: "/uploads/posts/sem-variant.png",
      preset: "hero",
      mediaVariants: {},
    });
    expect(resolved).toEqual({ avif: "", webp: "", fallback: "" });
  });

  it("prefere a URL fallback ao resolver uma variante unica", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          og: {
            formats: {
              avif: { url: "/uploads/_variants/u1/og-v1.avif" },
              webp: { url: "/uploads/_variants/u1/og-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/og-v1.jpeg" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantUrl({
        src: "/uploads/posts/capa.png",
        preset: "og",
        mediaVariants,
      }),
    ).toBe("/uploads/_variants/u1/og-v1.jpeg");
  });

  it("resolve focalPoints por preset e aplica fallback/clamp", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {},
        focalPoints: {
          hero: { x: 0.2, y: 0.8 },
          card: { x: 1.4, y: -0.2 },
        },
      },
      "/uploads/posts/sem-focal-preset.png": {
        variantsVersion: 1,
        variants: {},
        focalPoint: { x: 0.3, y: 0.7 },
      },
      "/uploads/posts/invalida.png": {
        variantsVersion: 1,
        variants: {},
        focalPoint: { x: Number.NaN, y: null },
      },
    };

    expect(
      resolveUploadVariantFocalPoint({
        src: "/uploads/posts/capa.png",
        preset: "hero",
        mediaVariants,
      }),
    ).toEqual({ x: 0.2, y: 0.8 });

    expect(
      resolveUploadVariantFocalPoint({
        src: "/uploads/posts/capa.png",
        preset: "cardWide",
        mediaVariants,
      }),
    ).toEqual({ x: 1, y: 0 });

    expect(
      resolveUploadVariantFocalPoint({
        src: "/uploads/posts/sem-focal-preset.png",
        preset: "hero",
        mediaVariants,
      }),
    ).toEqual({ x: 0.3, y: 0.7 });

    expect(
      resolveUploadVariantFocalPoint({
        src: "/uploads/posts/invalida.png",
        preset: "hero",
        mediaVariants,
      }),
    ).toBeNull();
  });

  it("resolve a variante poster quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/projects/capa.png": {
        variantsVersion: 2,
        variants: {
          poster: {
            formats: {
              avif: { url: "/uploads/_variants/u1/poster-v2.avif" },
              webp: { url: "/uploads/_variants/u1/poster-v2.webp" },
              fallback: { url: "/uploads/_variants/u1/poster-v2.jpeg" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantSources({
        src: "/uploads/projects/capa.png",
        preset: "poster",
        mediaVariants,
      }),
    ).toEqual({
      avif: "/uploads/_variants/u1/poster-v2.avif",
      webp: "/uploads/_variants/u1/poster-v2.webp",
      fallback: "/uploads/_variants/u1/poster-v2.jpeg",
    });
  });

  it("resolve a variante square quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/users/avatar.png": {
        variantsVersion: 5,
        variants: {
          square: {
            formats: {
              avif: { url: "/uploads/_variants/u1/square-v5.avif" },
              webp: { url: "/uploads/_variants/u1/square-v5.webp" },
              fallback: { url: "/uploads/_variants/u1/square-v5.png" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantUrl({
        src: "/uploads/users/avatar.png",
        preset: "square",
        mediaVariants,
      }),
    ).toBe("/uploads/_variants/u1/square-v5.png");
  });

  it("prefere o src original antes de avif quando nao ha fallback seguro", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 2,
        variants: {
          og: {
            formats: {
              avif: { url: "/uploads/_variants/u1/og-v2.avif" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantUrl({
        src: "/uploads/posts/capa.png",
        preset: "og",
        mediaVariants,
      }),
    ).toBe("/uploads/posts/capa.png");
  });
});
