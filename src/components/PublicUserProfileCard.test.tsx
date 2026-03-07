import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PublicUserProfileCard from "@/components/PublicUserProfileCard";

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [{ label: "Tradutor", icon: "languages" }],
    },
  }),
}));

describe("PublicUserProfileCard", () => {
  it("renderiza frase, bio, badges e favoritos com toggle mobile", async () => {
    render(
      <PublicUserProfileCard
        member={{
          id: "member-1",
          name: "Admin",
          avatarUrl: "/uploads/users/admin.png",
          phrase: "Frase",
          bio: "Bio",
          roles: ["Tradutor"],
          favoriteWorks: {
            manga: ["Naruto"],
            anime: ["Frieren"],
          },
          socials: [],
          status: "active",
        }}
        linkTypes={[]}
        mediaVariants={{}}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Admin" });
    const favoriteFrame = heading.closest("div.team-member-frame");

    expect(favoriteFrame).not.toBeNull();
    expect(favoriteFrame).toHaveClass("team-member-frame--has-favorites");
    expect(within(favoriteFrame as HTMLElement).getByText('"Frase"')).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Bio")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Tradutor")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Obras favoritas")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Naruto")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Frieren")).toBeInTheDocument();
    expect((favoriteFrame as HTMLElement).querySelector(".team-member-panel-shell")).toHaveClass(
      "team-member-panel-shell",
      "flex",
      "flex-col",
      "gap-4",
    );
    expect((favoriteFrame as HTMLElement).querySelector(".team-member-panel--bio")).not.toHaveClass(
      "flex",
    );
    expect(
      (favoriteFrame as HTMLElement).querySelector(".team-member-panel--favorites"),
    ).not.toHaveClass("flex");

    const toggleButton = within(favoriteFrame as HTMLElement).getByRole("button", {
      name: "Ver obras favoritas",
    });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteFrame).toHaveAttribute("data-mobile-favorites-open", "true");
  });

  it("usa proxy same-origin para avatar do Discord em perfis publicos", () => {
    render(
      <PublicUserProfileCard
        member={{
          id: "member-1",
          name: "Admin",
          avatarUrl: "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=128",
          phrase: "Frase",
          bio: "Bio",
          roles: ["Tradutor"],
          favoriteWorks: {
            manga: [],
            anime: [],
          },
          socials: [],
          status: "active",
        }}
        linkTypes={[]}
        mediaVariants={{}}
      />,
    );

    const avatar = screen.getByAltText("Admin");
    expect(avatar.getAttribute("src")).toContain(
      "/api/public/discord-avatar/123456789/avatar_hash.png?size=256",
    );
  });

  it("prefere a variante AVIF quadrada quando o avatar publico da equipe a expõe", () => {
    const { container } = render(
      <PublicUserProfileCard
        member={{
          id: "member-1",
          name: "Admin",
          avatarUrl: "/uploads/users/admin.png",
          phrase: "Frase",
          bio: "Bio",
          roles: [],
          favoriteWorks: {
            manga: [],
            anime: [],
          },
          socials: [],
          status: "active",
        }}
        linkTypes={[]}
        mediaVariants={{
          "/uploads/users/admin.png": {
            variantsVersion: 2,
            variants: {
              square: {
                width: 512,
                height: 512,
                formats: {
                  avif: {
                    url: "/uploads/_variants/u-1/square-v2.avif",
                  },
                  fallback: {
                    url: "/uploads/_variants/u-1/square-v2.png",
                  },
                },
              },
            },
          },
        }}
      />,
    );

    const avifSource = container.querySelector('source[type="image/avif"]');
    expect(avifSource).toHaveAttribute(
      "srcset",
      "http://localhost:3000/uploads/_variants/u-1/square-v2.avif 512w",
    );
  });
});
