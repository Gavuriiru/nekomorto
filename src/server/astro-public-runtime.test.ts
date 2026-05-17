import { describe, expect, it, vi } from "vitest";

import { resolveAstroPublicRoutePayload } from "../../server/lib/astro-public-runtime.js";

describe("resolveAstroPublicRoutePayload", () => {
  it("builds the team payload for /equipe", async () => {
    const buildPublicMediaVariants = vi.fn(() => ({
      "/uploads/team/avatar.png": {
        variantsVersion: 3,
      },
    }));
    const buildPublicTeamMembers = vi.fn(() => [
      {
        id: "member-1",
        name: "Membro",
        avatarUrl: "/uploads/team/avatar.png",
      },
    ]);
    const loadLinkTypes = vi.fn(() => [{ id: "site", label: "Site", icon: "globe" }]);

    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/equipe",
      buildPublicMediaVariants,
      buildPublicTeamMembers,
      loadLinkTypes,
    });

    expect(payload).toEqual({
      kind: "team",
      generatedAt: expect.any(String),
      mediaVariants: {
        "/uploads/team/avatar.png": {
          variantsVersion: 3,
        },
      },
      teamLinkTypes: [{ id: "site", label: "Site", icon: "globe" }],
      teamMembers: [
        {
          accessRole: "",
          avatarDisplay: "",
          avatarUrl: "/uploads/team/avatar.png",
          bio: "",
          favoriteWorks: {},
          id: "member-1",
          isAdmin: false,
          name: "Membro",
          order: undefined,
          permissions: [],
          phrase: "",
          roles: [],
          socials: [],
          status: "",
        },
      ],
    });
    expect(buildPublicMediaVariants).toHaveBeenCalledWith(
      [
        [{ id: "member-1", name: "Membro", avatarUrl: "/uploads/team/avatar.png" }],
        [{ id: "site", label: "Site", icon: "globe" }],
      ],
      {
        allowPrivateUrls: ["/uploads/team/avatar.png"],
      },
    );
  });

  it("builds the donations payload for /doacoes", async () => {
    const resolvePublicDonationsRoutePayload = vi.fn(async () => ({
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        "0": "data:image/png;base64,btc",
      },
    }));

    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/doacoes",
      pages: {
        donations: {
          pixKey: "pix-key",
        },
      },
      siteSettings: {
        site: {
          name: "NEKOMATA",
        },
        footer: {
          brandName: "NEKOMATA",
        },
      },
      resolvePublicDonationsRoutePayload,
    });

    expect(payload).toEqual({
      kind: "donations",
      generatedAt: expect.any(String),
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        "0": "data:image/png;base64,btc",
      },
    });
    expect(resolvePublicDonationsRoutePayload).toHaveBeenCalledWith({
      donationsPage: {
        pixKey: "pix-key",
      },
      merchantName: "NEKOMATA",
    });
  });

  it("returns null for routes without dedicated Astro payloads", async () => {
    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/sobre",
    });

    expect(payload).toBeNull();
  });
});
