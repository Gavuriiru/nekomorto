import { describe, expect, it } from "vitest";

import { resolvePublicTeamAvatarPreload } from "../../server/lib/public-team-preloads.js";

describe("public team preloads", () => {
  it("prioritizes the first active member avatar preload", () => {
    const preload = resolvePublicTeamAvatarPreload({
      teamMembers: [
        {
          id: "retired-1",
          name: "Aposentado",
          avatarUrl: "/uploads/users/retired.png",
          status: "retired",
        },
        {
          id: "active-1",
          name: "Ativo",
          avatarUrl: "/uploads/users/active.png",
          status: "active",
        },
      ],
      mediaVariants: {
        "/uploads/users/active.png": {
          variantsVersion: 3,
          variants: {
            square: {
              width: 512,
              formats: {
                avif: { url: "/uploads/_variants/team/active-square-v3.avif" },
                fallback: { url: "/uploads/_variants/team/active-square-v3.png" },
              },
            },
          },
        },
      },
      resolveVariantUrl: () => "",
    });

    expect(preload).toEqual({
      href: "/uploads/_variants/team/active-square-v3.png",
      as: "image",
      type: "image/avif",
      imagesrcset: "/uploads/_variants/team/active-square-v3.avif 512w",
      imagesizes: "(max-width: 639px) 224px, (max-width: 767px) 240px, 256px",
      fetchpriority: "high",
    });
  });

  it("falls back to the first retired member when there is no active team member", () => {
    const preload = resolvePublicTeamAvatarPreload({
      teamMembers: [
        {
          id: "retired-1",
          name: "Aposentado",
          avatarUrl: "/uploads/users/retired.png",
          status: "retired",
        },
      ],
      mediaVariants: {},
      resolveVariantUrl: () => "",
    });

    expect(preload).toEqual({
      href: "/uploads/users/retired.png",
      as: "image",
      fetchpriority: "high",
    });
  });
});
