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

    const toggleButton = within(favoriteFrame as HTMLElement).getByRole("button", {
      name: "Ver obras favoritas",
    });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(favoriteFrame).toHaveAttribute("data-mobile-favorites-open", "true");
  });
});
