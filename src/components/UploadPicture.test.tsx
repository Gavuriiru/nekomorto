import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UploadPicture from "@/components/UploadPicture";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

describe("UploadPicture", () => {
  it("renderiza sources avif/webp e fallback de variante quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 3,
        variants: {
          card: {
            formats: {
              avif: { url: "/uploads/_variants/u123/card-v3.avif" },
              webp: { url: "/uploads/_variants/u123/card-v3.webp" },
              fallback: { url: "/uploads/_variants/u123/card-v3.jpeg" },
            },
          },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/posts/capa.png"
        alt="Capa teste"
        preset="card"
        mediaVariants={mediaVariants}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("type", "image/avif");
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/uploads/_variants/u123/card-v3.avif"));
    expect(sources[1]).toHaveAttribute("type", "image/webp");
    expect(sources[1]).toHaveAttribute("srcset", expect.stringContaining("/uploads/_variants/u123/card-v3.webp"));

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", expect.stringContaining("/uploads/_variants/u123/card-v3.jpeg"));
  });

  it("usa src original quando nao ha variantes", () => {
    const { container } = render(
      <UploadPicture src="/uploads/posts/original.jpg" alt="Original" preset="hero" mediaVariants={{}} />,
    );
    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(0);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", expect.stringContaining("/uploads/posts/original.jpg"));
  });

  it("usa o src original no img quando a variante salva apenas avif", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 6,
        variants: {
          hero: {
            formats: {
              avif: { url: "/uploads/_variants/u123/hero-v6.avif" },
            },
          },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/posts/capa.png"
        alt="Somente avif"
        preset="hero"
        mediaVariants={mediaVariants}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(1);
    expect(sources[0]).toHaveAttribute("type", "image/avif");
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/uploads/_variants/u123/hero-v6.avif"));
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/uploads/posts/capa.png"));
  });

  it("resolve a variante cardWide quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 4,
        variants: {
          cardWide: {
            formats: {
              avif: { url: "/uploads/_variants/u123/cardWide-v4.avif" },
              webp: { url: "/uploads/_variants/u123/cardWide-v4.webp" },
              fallback: { url: "/uploads/_variants/u123/cardWide-v4.jpeg" },
            },
          },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/posts/capa.png"
        alt="Capa wide"
        preset="cardWide"
        mediaVariants={mediaVariants}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/cardWide-v4.avif"),
    );
    expect(sources[1]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/cardWide-v4.webp"),
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/u123/cardWide-v4.jpeg"),
    );
  });

  it("resolve a variante poster quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/projects/capa.png": {
        variantsVersion: 2,
        variants: {
          poster: {
            formats: {
              avif: { url: "/uploads/_variants/u123/poster-v2.avif" },
              webp: { url: "/uploads/_variants/u123/poster-v2.webp" },
              fallback: { url: "/uploads/_variants/u123/poster-v2.jpeg" },
            },
          },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/projects/capa.png"
        alt="Poster"
        preset="poster"
        mediaVariants={mediaVariants}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/poster-v2.avif"),
    );
    expect(sources[1]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/poster-v2.webp"),
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/u123/poster-v2.jpeg"),
    );
  });

  it("resolve a variante square quando disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/users/avatar.png": {
        variantsVersion: 7,
        variants: {
          square: {
            formats: {
              avif: { url: "/uploads/_variants/u123/square-v7.avif" },
              webp: { url: "/uploads/_variants/u123/square-v7.webp" },
              fallback: { url: "/uploads/_variants/u123/square-v7.png" },
            },
          },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/users/avatar.png"
        alt="Avatar"
        preset="square"
        mediaVariants={mediaVariants}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/square-v7.avif"),
    );
    expect(sources[1]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u123/square-v7.webp"),
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/u123/square-v7.png"),
    );
  });

  it("aplica object-position quando solicitado e ha foco disponivel", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          hero: {
            formats: {
              fallback: { url: "/uploads/_variants/u123/hero-v1.jpeg" },
            },
          },
        },
        focalPoints: {
          hero: { x: 0.25, y: 0.75 },
        },
      },
    };

    const { container } = render(
      <UploadPicture
        src="/uploads/posts/capa.png"
        alt="Hero com foco"
        preset="hero"
        mediaVariants={mediaVariants}
        applyFocalObjectPosition
      />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveStyle({ objectPosition: "25% 75%" });
  });

  it("mantem comportamento padrao quando applyFocalObjectPosition esta desativado ou sem foco", () => {
    const mediaVariants: UploadMediaVariantsMap = {
      "/uploads/posts/capa.png": {
        variantsVersion: 1,
        variants: {
          hero: {
            formats: {
              fallback: { url: "/uploads/_variants/u123/hero-v1.jpeg" },
            },
          },
        },
        focalPoints: {
          hero: { x: 0.25, y: 0.75 },
        },
      },
      "/uploads/posts/sem-foco.png": {
        variantsVersion: 1,
        variants: {
          hero: {
            formats: {
              fallback: { url: "/uploads/_variants/u123/hero-v1.jpeg" },
            },
          },
        },
      },
    };

    const { container: disabledContainer } = render(
      <UploadPicture
        src="/uploads/posts/capa.png"
        alt="Sem aplicar foco"
        preset="hero"
        mediaVariants={mediaVariants}
      />,
    );
    const disabledImg = disabledContainer.querySelector("img");
    expect(disabledImg).not.toBeNull();
    expect(disabledImg?.style.objectPosition).toBe("");

    const { container: missingFocalContainer } = render(
      <UploadPicture
        src="/uploads/posts/sem-foco.png"
        alt="Sem foco"
        preset="hero"
        mediaVariants={mediaVariants}
        applyFocalObjectPosition
      />,
    );
    const missingFocalImg = missingFocalContainer.querySelector("img");
    expect(missingFocalImg).not.toBeNull();
    expect(missingFocalImg).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/u123/hero-v1.jpeg"),
    );
    expect(missingFocalImg?.style.objectPosition).toBe("");
  });
});
