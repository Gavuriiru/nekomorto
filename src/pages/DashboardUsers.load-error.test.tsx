import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("DashboardUsers load error", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("exibe erro bloqueante e recupera após retry", async () => {
    let usersRequestCount = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        usersRequestCount += 1;
        if (usersRequestCount === 1) {
          return mockJsonResponse(false, { error: "load_failed" }, 500);
        }
        return mockJsonResponse(true, {
          users: [
            {
              id: "u-1",
              name: "Admin",
              phrase: "",
              bio: "",
              avatarUrl: null,
              socials: [],
              status: "active",
              permissions: ["usuarios_basico"],
              roles: [],
              accessRole: "admin",
              order: 0,
            },
          ],
          ownerIds: [],
          primaryOwnerId: null,
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
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

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gestão de Usuários/i });
    await screen.findByText(/Não foi possível carregar os usuários/i);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.queryByText(/Não foi possível carregar os usuários/i)).not.toBeInTheDocument();
    });
    await screen.findByText("Admin");
    expect(usersRequestCount).toBeGreaterThanOrEqual(2);
  });
});
