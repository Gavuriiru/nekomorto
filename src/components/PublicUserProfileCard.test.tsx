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
  it("alterna favoritas por clique e teclado sem abrir no hover", async () => {
    const { container } = render(
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

    const cardRoot = container.firstElementChild as HTMLElement | null;
    const heading = screen.getByRole("heading", { name: "Admin" });
    const favoriteFrame = heading.closest("div.team-member-frame");

    expect(cardRoot).not.toBeNull();
    expect(cardRoot).toHaveClass("group", "team-member-card--interactive");
    expect(cardRoot).toHaveAttribute("tabindex", "0");
    expect(favoriteFrame).not.toBeNull();
    expect(favoriteFrame).toHaveClass("team-member-frame--has-favorites");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");
    expect(within(favoriteFrame as HTMLElement).getByText('"Frase"')).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Bio")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Tradutor")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Obras favoritas")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Naruto")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Frieren")).toBeInTheDocument();
    expect(
      within(favoriteFrame as HTMLElement).getByText("Clique para ver as obras favoritas"),
    ).toBeInTheDocument();
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

    fireEvent.mouseEnter(cardRoot as HTMLElement);
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");

    fireEvent.click(cardRoot as HTMLElement);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "true");

    fireEvent.click(cardRoot as HTMLElement);
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");

    fireEvent.keyDown(cardRoot as HTMLElement, { key: "Enter" });
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "true");

    fireEvent.keyDown(cardRoot as HTMLElement, { key: " " });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");
  });

  it("ignora clique em link social e preserva o botao mobile sem toggle duplo", () => {
    const { container } = render(
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
          socials: [{ label: "site", href: "https://example.com" }],
          status: "active",
        }}
        linkTypes={[{ id: "site", label: "Site", icon: "globe" }]}
        mediaVariants={{}}
      />,
    );

    const cardRoot = container.firstElementChild as HTMLElement | null;
    const favoriteFrame = screen
      .getByRole("heading", { name: "Admin" })
      .closest("div.team-member-frame");
    expect(cardRoot).not.toBeNull();
    expect(favoriteFrame).not.toBeNull();

    const socialLink = within(favoriteFrame as HTMLElement).getByRole("link", {
      name: "Site",
    });
    fireEvent.click(socialLink);
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");

    const toggleButton = within(favoriteFrame as HTMLElement).getByRole("button", {
      name: "Ver obras favoritas",
    });
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "true");

    fireEvent.click(cardRoot as HTMLElement);
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(favoriteFrame).toHaveAttribute("data-favorites-open", "false");
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
