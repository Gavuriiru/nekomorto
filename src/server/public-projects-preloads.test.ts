import { describe, expect, it } from "vitest";

import {
  PROJECTS_LIST_IMAGE_SIZES,
  resolvePublicProjectsListPreloads,
} from "../../server/lib/public-projects-preloads.js";

describe("public projects list preloads", () => {
  it("ordena os projetos da listagem e pre-carrega as quatro primeiras capas", () => {
    const projects = [
      { title: "Zeta", cover: "/uploads/projects/zeta.png" },
      { title: "Alpha", cover: "/uploads/projects/alpha.png" },
      { title: "Beta", cover: "/uploads/projects/beta.png" },
      { title: "Delta", cover: "/uploads/projects/delta.png" },
      { title: "Gamma", cover: "/uploads/projects/gamma.png" },
    ];
    const mediaVariants = Object.fromEntries(
      ["alpha", "beta", "delta", "gamma", "zeta"].map((slug, index) => [
        `/uploads/projects/${slug}.png`,
        {
          variantsVersion: 3,
          variants: {
            posterThumb: {
              width: 320,
              formats: {
                avif: { url: `/uploads/_variants/${slug}/poster-thumb-v3.avif` },
                fallback: { url: `/uploads/_variants/${slug}/poster-thumb-v3.jpeg` },
              },
            },
            poster: {
              width: 920,
              formats: {
                avif: { url: `/uploads/_variants/${slug}/poster-v3.avif` },
                fallback: { url: `/uploads/_variants/${slug}/poster-v3.jpeg` },
              },
            },
          },
        },
      ]),
    );

    const preloads = resolvePublicProjectsListPreloads({
      projects,
      mediaVariants,
      resolveVariantUrl: () => "",
    });

    expect(preloads).toHaveLength(4);
    expect(preloads[0]).toEqual(
      expect.objectContaining({
        href: "/uploads/_variants/alpha/poster-thumb-v3.jpeg",
        as: "image",
        type: "image/avif",
        imagesizes: PROJECTS_LIST_IMAGE_SIZES,
        imagesrcset: expect.stringContaining("/uploads/_variants/alpha/poster-thumb-v3.avif 320w"),
        fetchpriority: "high",
      }),
    );
    expect(preloads[0]?.imagesrcset).toContain("/uploads/_variants/alpha/poster-v3.avif 920w");
    expect(preloads[1]?.href).toBe("/uploads/_variants/beta/poster-thumb-v3.jpeg");
    expect(preloads[2]?.href).toBe("/uploads/_variants/delta/poster-thumb-v3.jpeg");
    expect(preloads[3]?.href).toBe("/uploads/_variants/gamma/poster-thumb-v3.jpeg");
  });
});
