import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const adminUser = {
  id: "admin-1",
  name: "Admin",
  phrase: "",
  bio: "",
  avatarUrl: null,
  socials: [],
  favoriteWorks: { manga: [], anime: [] },
  status: "active" as const,
  permissions: ["usuarios_basico"],
  roles: [],
  accessRole: "admin" as const,
  order: 0,
};

const targetUser = {
  id: "user-2",
  name: "Colaborador",
  phrase: "Frase antiga",
  bio: "Bio antiga",
  avatarUrl: null,
  socials: [],
  favoriteWorks: { manga: [], anime: [] },
  status: "active" as const,
  permissions: [],
  roles: ["Tradutor"],
  accessRole: "normal" as const,
  order: 1,
};

describe("DashboardUsers favorite works", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [adminUser, targetUser],
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
            usuarios_acesso: false,
          },
          ownerIds: [],
          primaryOwnerId: null,
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/users/user-2" && method === "PUT") {
        const payload = (options as { json?: Record<string, unknown> } | undefined)?.json || {};
        return mockJsonResponse(true, {
          user: {
            ...targetUser,
            ...payload,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("renderiza grade 2x3 e envia payload categorizado saneado", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.*rio Colaborador/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByPlaceholderText("Mangá 1")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Mangá 2")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Mangá 3")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Anime 1")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Anime 2")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Anime 3")).toBeInTheDocument();

    const longTitle = "A".repeat(120);
    const manga1 = within(dialog).getByPlaceholderText("Mangá 1") as HTMLInputElement;
    fireEvent.change(manga1, { target: { value: "  Naruto  " } });
    expect(manga1.value).toBe("  Naruto  ");
    fireEvent.change(within(dialog).getByPlaceholderText("Mangá 2"), {
      target: { value: "naruto" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Mangá 3"), {
      target: { value: longTitle },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Anime 1"), {
      target: { value: " One Piece " },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Anime 2"), {
      target: { value: "ONE PIECE" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Anime 3"), {
      target: { value: "Frieren" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === "/api/users/user-2" && method === "PUT";
      });
      expect(putCall).toBeTruthy();
      const payload = (putCall?.[2] as { json?: Record<string, unknown> }).json || {};
      expect(payload).toMatchObject({
        favoriteWorks: {
          manga: ["Naruto", "A".repeat(80)],
          anime: ["One Piece", "Frieren"],
        },
      });
      expect(payload).not.toHaveProperty("permissions");
      expect(payload).not.toHaveProperty("accessRole");
      expect(payload).not.toHaveProperty("status");
      expect(payload).not.toHaveProperty("roles");
      expect(payload).not.toHaveProperty("id");
    });
  });
});
