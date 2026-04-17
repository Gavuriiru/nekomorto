import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUsers from "@/pages/DashboardUsers";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
    },
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const classTokens = (element: Element | null) =>
  String((element as HTMLElement | null)?.className || "")
    .split(/\s+/)
    .filter(Boolean);

const createUser = (
  overrides: Partial<{
    id: string;
    name: string;
    phrase: string;
    bio: string;
    avatarUrl: string | null;
    revision: string;
    status: "active" | "retired";
    roles: string[];
    accessRole: "normal" | "admin" | "owner";
    order: number;
  }> = {},
) => ({
  id: overrides.id ?? "user-1",
  name: overrides.name ?? "Pessoa de Teste",
  phrase: overrides.phrase ?? "Frase de apoio longa para estressar o layout horizontal do card.",
  bio:
    overrides.bio ??
    "Biografia mais longa para validar clamp, quebra de linha previsivel e ausencia de sobreposicao entre texto e controles.",
  avatarUrl: overrides.avatarUrl ?? null,
  revision: overrides.revision,
  socials: [],
  status: overrides.status ?? "active",
  permissions: [],
  roles: overrides.roles ?? ["roteirista"],
  accessRole: overrides.accessRole ?? "normal",
  order: overrides.order ?? 0,
});

const renderDashboardUsers = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
      <DashboardUsers />
    </MemoryRouter>,
  );

const setupApiMock = (users: ReturnType<typeof createUser>[]) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users,
        ownerIds: [],
        primaryOwnerId: null,
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "admin-1",
        name: "Admin",
        username: "admin",
        accessRole: "admin",
        grants: {
          usuarios_basico: true,
          usuarios_acesso: true,
        },
        ownerIds: [],
        primaryOwnerId: null,
      });
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardUsers card layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("shares the responsive card shell between active and retired users", async () => {
    setupApiMock([
      createUser({
        id: "active-1",
        name: "Alana nome bem longo para pressionar o layout ativo",
        order: 0,
      }),
      createUser({
        id: "active-2",
        name: "Bruno nome bem longo para pressionar o segundo card ativo",
        order: 1,
      }),
      createUser({
        id: "active-3",
        name: "Caio nome bem longo para validar o ultimo card impar",
        order: 2,
        roles: ["editor", "curadoria"],
      }),
      createUser({
        id: "retired-1",
        name: "Dora nome bem longo para validar o card aposentado",
        status: "retired",
        order: 3,
        roles: ["administrador"],
      }),
    ]);

    renderDashboardUsers();

    const activeGrid = await screen.findByTestId("dashboard-users-active-grid");
    const retiredGrid = await screen.findByTestId("dashboard-users-retired-grid");
    const activeCard = await screen.findByTestId("dashboard-user-card-active-1");
    const activeOddCard = await screen.findByTestId("dashboard-user-card-active-3");
    const retiredCard = await screen.findByTestId("dashboard-user-card-retired-1");

    expect(classTokens(activeGrid)).toEqual(
      expect.arrayContaining(["grid", "gap-4", "lg:grid-cols-2"]),
    );
    expect(classTokens(activeGrid)).not.toContain("md:grid-cols-2");
    expect(classTokens(retiredGrid)).toEqual(
      expect.arrayContaining(["grid", "gap-4", "lg:grid-cols-2"]),
    );
    expect(classTokens(retiredGrid)).not.toContain("md:grid-cols-2");

    expect(classTokens(activeOddCard)).toEqual(
      expect.arrayContaining(["lg:col-span-2", "lg:mx-auto", "lg:w-[calc(50%-0.5rem)]"]),
    );
    expect(classTokens(retiredCard)).toEqual(
      expect.arrayContaining(["lg:col-span-2", "lg:mx-auto", "lg:w-[calc(50%-0.5rem)]"]),
    );

    for (const card of [activeCard, retiredCard]) {
      const shell = card.querySelector('[data-slot="user-card-shell"]');
      const main = card.querySelector('[data-slot="user-card-main"]');
      const summary = card.querySelector('[data-slot="user-card-summary"]');
      const title = card.querySelector('[data-slot="user-card-title"]');
      const bio = card.querySelector('[data-slot="user-card-bio"]');
      const controls = card.querySelector('[data-slot="user-card-controls"]');

      expect(shell).not.toBeNull();
      expect(classTokens(shell)).toEqual(
        expect.arrayContaining(["flex-col", "lg:flex-row", "lg:justify-between"]),
      );
      expect(main).not.toBeNull();
      expect(classTokens(main)).toEqual(
        expect.arrayContaining(["min-w-0", "flex-col", "sm:flex-row"]),
      );
      expect(summary).not.toBeNull();
      expect(classTokens(summary)).toEqual(expect.arrayContaining(["min-w-0", "flex-1"]));
      expect(title).not.toBeNull();
      expect(classTokens(title)).toEqual(expect.arrayContaining(["min-w-0", "flex-wrap"]));
      expect(bio).not.toBeNull();
      expect(classTokens(bio)).toEqual(
        expect.arrayContaining(["line-clamp-2", "[-webkit-line-clamp:2]"]),
      );
      expect(controls).not.toBeNull();
      expect(classTokens(controls)).toEqual(
        expect.arrayContaining(["shrink-0", "flex-wrap", "self-start", "lg:self-auto"]),
      );
    }
  });
});
