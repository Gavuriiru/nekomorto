import { describe, expect, it } from "vitest";

import {
  normalizeUploadVariantUrlKey,
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
});

