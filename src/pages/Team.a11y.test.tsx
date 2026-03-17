import { axe } from "jest-axe";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Team from "@/pages/Team";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const usersFixture = [
  {
    id: "member-active",
    name: "Integrante ativo",
    avatarUrl: "/uploads/users/active-avatar.png",
    phrase: "Frase ativa",
    bio: "Bio ativa",
    status: "active",
    roles: ["Membro"],
    socials: [{ label: "site", href: "https://active.dev" }],
    favoriteWorks: { manga: [], anime: [] },
  },
  {
    id: "member-retired",
    name: "Integrante aposentado",
    avatarUrl: "/uploads/users/retired-avatar.png",
    phrase: "Frase aposentado",
    bio: "Bio aposentado",
    status: "retired",
    roles: ["Membro"],
    socials: [{ label: "site", href: "https://retired.dev" }],
    favoriteWorks: { manga: [], anime: [] },
  },
];

describe("Team accessibility", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();

        if (endpoint === "/api/public/users" && method === "GET") {
          return mockJsonResponse(true, {
            users: usersFixture,
            mediaVariants: {},
          });
        }
        if (endpoint === "/api/link-types" && method === "GET") {
          return mockJsonResponse(true, { items: [{ id: "site", label: "Site", icon: "globe" }] });
        }
        if (endpoint === "/api/public/pages" && method === "GET") {
          return mockJsonResponse(true, { pages: { team: {} } });
        }

        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );
  });

  it("mantem a ordem semantica dos headings sem violacoes axe", async () => {
    const { container } = render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /faz o projeto acontecer/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Membros ativos" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Membros aposentados" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "Integrante ativo" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "Integrante aposentado" }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
