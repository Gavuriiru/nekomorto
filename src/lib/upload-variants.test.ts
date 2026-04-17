import { describe, expect, it } from "vitest";

import {
  normalizeUploadVariantUrlKey,
  resolveUploadVariantFocalPoint,
  resolveUploadVariantResponsiveSources,
  resolveUploadVariantSources,
  resolveUploadVariantUrl,
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

  it("resolve cardHome quando a variante dedicada existe", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          cardHome: {
            formats: {
              avif: { url: "/uploads/_variants/u1/cardHome-v1.avif" },
              webp: { url: "/uploads/_variants/u1/cardHome-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/cardHome-v1.jpeg" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantSources({
        src: "/uploads/posts/capa.png",
        preset: "cardHome",
        mediaVariants,
      }),
    ).toEqual({
      avif: "/uploads/_variants/u1/cardHome-v1.avif",
      webp: "/uploads/_variants/u1/cardHome-v1.webp",
      fallback: "/uploads/_variants/u1/cardHome-v1.jpeg",
    });
  });

  it("monta srcset responsivo de cardHome com variantes menores", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          cardHomeXs: {
            width: 480,
            formats: {
              avif: { url: "/uploads/_variants/u1/cardHomeXs-v1.avif" },
              webp: { url: "/uploads/_variants/u1/cardHomeXs-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/cardHomeXs-v1.jpeg" },
            },
          },
          cardHomeSm: {
            width: 800,
            formats: {
              avif: { url: "/uploads/_variants/u1/cardHomeSm-v1.avif" },
              webp: { url: "/uploads/_variants/u1/cardHomeSm-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/cardHomeSm-v1.jpeg" },
            },
          },
          cardHome: {
            width: 960,
            formats: {
              avif: { url: "/uploads/_variants/u1/cardHome-v1.avif" },
              webp: { url: "/uploads/_variants/u1/cardHome-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/cardHome-v1.jpeg" },
            },
          },
          card: {
            width: 1280,
            formats: {
              avif: { url: "/uploads/_variants/u1/card-v1.avif" },
              webp: { url: "/uploads/_variants/u1/card-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/card-v1.jpeg" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantResponsiveSources({
        src: "/uploads/posts/capa.png",
        preset: "cardHome",
        mediaVariants,
      }),
    ).toEqual({
      avifSrcSet:
        "/uploads/_variants/u1/cardHomeXs-v1.avif 480w, /uploads/_variants/u1/cardHomeSm-v1.avif 800w, /uploads/_variants/u1/cardHome-v1.avif 960w, /uploads/_variants/u1/card-v1.avif 1280w",
      webpSrcSet:
        "/uploads/_variants/u1/cardHomeXs-v1.webp 480w, /uploads/_variants/u1/cardHomeSm-v1.webp 800w, /uploads/_variants/u1/cardHome-v1.webp 960w, /uploads/_variants/u1/card-v1.webp 1280w",
      fallbackSrcSet:
        "/uploads/_variants/u1/cardHomeXs-v1.jpeg 480w, /uploads/_variants/u1/cardHomeSm-v1.jpeg 800w, /uploads/_variants/u1/cardHome-v1.jpeg 960w, /uploads/_variants/u1/card-v1.jpeg 1280w",
    });
  });

  it("monta srcset responsivo de hero com xs/sm/md/base", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          heroXs: {
            formats: {
              avif: { url: "/uploads/_variants/u1/heroXs-v1.avif" },
            },
          },
          heroSm: {
            formats: {
              avif: { url: "/uploads/_variants/u1/heroSm-v1.avif" },
            },
          },
          heroMd: {
            formats: {
              avif: { url: "/uploads/_variants/u1/heroMd-v1.avif" },
            },
          },
          hero: {
            formats: {
              avif: { url: "/uploads/_variants/u1/hero-v1.avif" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantResponsiveSources({
        src: "/uploads/posts/capa.png",
        preset: "hero",
        mediaVariants,
      }),
    ).toEqual({
      avifSrcSet:
        "/uploads/_variants/u1/heroXs-v1.avif 768w, /uploads/_variants/u1/heroSm-v1.avif 960w, /uploads/_variants/u1/heroMd-v1.avif 1280w, /uploads/_variants/u1/hero-v1.avif 1600w",
      webpSrcSet: "",
      fallbackSrcSet: "",
    });
  });

  it("monta srcset responsivo de posterThumb com sm/base/poster", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/projects/capa.png": {
        variantsVersion: 1,
        variants: {
          posterThumbSm: {
            formats: {
              avif: { url: "/uploads/_variants/u1/posterThumbSm-v1.avif" },
              webp: { url: "/uploads/_variants/u1/posterThumbSm-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/posterThumbSm-v1.jpeg" },
            },
          },
          posterThumb: {
            formats: {
              avif: { url: "/uploads/_variants/u1/posterThumb-v1.avif" },
              webp: { url: "/uploads/_variants/u1/posterThumb-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/posterThumb-v1.jpeg" },
            },
          },
          poster: {
            formats: {
              avif: { url: "/uploads/_variants/u1/poster-v1.avif" },
              webp: { url: "/uploads/_variants/u1/poster-v1.webp" },
              fallback: { url: "/uploads/_variants/u1/poster-v1.jpeg" },
            },
          },
        },
      },
    };

    expect(
      resolveUploadVariantResponsiveSources({
        src: "/uploads/projects/capa.png",
        preset: "posterThumb",
        mediaVariants,
      }),
    ).toEqual({
      avifSrcSet:
        "/uploads/_variants/u1/posterThumbSm-v1.avif 192w, /uploads/_variants/u1/posterThumb-v1.avif 320w, /uploads/_variants/u1/poster-v1.avif 920w",
      webpSrcSet:
        "/uploads/_variants/u1/posterThumbSm-v1.webp 192w, /uploads/_variants/u1/posterThumb-v1.webp 320w, /uploads/_variants/u1/poster-v1.webp 920w",
      fallbackSrcSet:
        "/uploads/_variants/u1/posterThumbSm-v1.jpeg 192w, /uploads/_variants/u1/posterThumb-v1.jpeg 320w, /uploads/_variants/u1/poster-v1.jpeg 920w",
    });
  });

  it("faz fallback semantico de cardHome para card", () => {
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

    expect(
      resolveUploadVariantUrl({
        src: "/uploads/posts/capa.png",
        preset: "cardHome",
        mediaVariants,
      }),
    ).toBe("/uploads/_variants/u1/card-v1.jpeg");
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
        preset: "heroXs",
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

  it("faz fallback semantico de posterThumb para poster", () => {
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
        preset: "posterThumb",
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
