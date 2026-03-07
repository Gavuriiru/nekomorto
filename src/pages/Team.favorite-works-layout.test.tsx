import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Team from "@/pages/Team";

const apiFetchMock = vi.hoisted(() => vi.fn());
type BootstrapWindow = Window &
  typeof globalThis & {
    __BOOTSTRAP_PUBLIC__?: unknown;
  };

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const favoriteMemberName = "Membro com favoritos";
const defaultMemberName = "Membro sem favoritos";

describe("Team favorite works layout", () => {
  beforeEach(() => {
    delete (window as BootstrapWindow).__BOOTSTRAP_PUBLIC__;
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (endpoint === "/api/public/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [
            {
              id: "member-favorites",
              name: favoriteMemberName,
              avatarUrl: "/uploads/users/member-favorites.png",
              phrase: "Frase",
              bio: "Bio favorita",
              status: "active",
              roles: ["Membro"],
              favoriteWorks: {
                manga: ["Naruto", "Bleach", "Vinland Saga", "Excedente"],
                anime: ["One Piece", "Frieren"],
              },
              socials: [],
            },
            {
              id: "member-default",
              name: defaultMemberName,
              avatarUrl: "/uploads/users/member-default.png",
              phrase: "Frase sem favoritos",
              bio: "Bio sem favoritos",
              status: "active",
              roles: ["Membro"],
              favoriteWorks: { manga: [], anime: [] },
              socials: [],
            },
          ],
          mediaVariants: {},
        });
      }
      if (endpoint === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("renderiza painel de obras favoritas apenas quando houver itens", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const favoriteHeading = await screen.findByRole("heading", { name: favoriteMemberName });
    const favoriteFrame = favoriteHeading.closest("div.team-member-frame");
    expect(favoriteFrame).not.toBeNull();
    expect(favoriteFrame).toHaveClass("team-member-frame--has-favorites");
    expect(within(favoriteFrame as HTMLElement).getByText("Obras favoritas")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText(/Mang/i)).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Anime")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Naruto")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Bleach")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Vinland Saga")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("One Piece")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).getByText("Frieren")).toBeInTheDocument();
    expect(within(favoriteFrame as HTMLElement).queryByText("Excedente")).toBeNull();

    const defaultHeading = screen.getByRole("heading", { name: defaultMemberName });
    const defaultFrame = defaultHeading.closest("div.team-member-frame");
    expect(defaultFrame).not.toBeNull();
    expect(defaultFrame).not.toHaveClass("team-member-frame--has-favorites");
    expect(within(defaultFrame as HTMLElement).queryByText("Obras favoritas")).toBeNull();
  });

  it("alterna estado mobile com botao de obras favoritas", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const favoriteHeading = await screen.findByRole("heading", { name: favoriteMemberName });
    const favoriteFrame = favoriteHeading.closest("div.team-member-frame");
    expect(favoriteFrame).not.toBeNull();

    const toggleButton = within(favoriteFrame as HTMLElement).getByRole("button", {
      name: "Ver obras favoritas",
    });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(favoriteFrame).toHaveAttribute("data-mobile-favorites-open", "false");

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(toggleButton).toHaveTextContent("Ver bio");
    expect(favoriteFrame).toHaveAttribute("data-mobile-favorites-open", "true");
  });

  it("mantem classes estruturais para troca por hover/focus no desktop", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const favoriteHeading = await screen.findByRole("heading", { name: favoriteMemberName });
    const favoriteFrame = favoriteHeading.closest("div.team-member-frame");
    expect(favoriteFrame).not.toBeNull();
    expect(favoriteFrame).toHaveClass("team-member-frame--has-favorites");

    const panelShell = favoriteFrame?.querySelector(".team-member-panel-shell");
    const bioPanel = favoriteFrame?.querySelector(".team-member-panel--bio");
    const favoritesPanel = favoriteFrame?.querySelector(".team-member-panel--favorites");

    expect(panelShell).not.toBeNull();
    expect(bioPanel).not.toBeNull();
    expect(favoritesPanel).not.toBeNull();
    expect(bioPanel).not.toHaveClass("flex");
    expect(favoritesPanel).not.toHaveClass("flex");
  });
});
