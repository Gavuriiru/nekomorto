import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  status: "active" as const,
  permissions: [],
  roles: ["Tradutor"],
  accessRole: "normal" as const,
  order: 1,
};

describe("DashboardUsers permissions matrix", () => {
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
            posts: false,
            projetos: false,
            comentarios: false,
            paginas: false,
            uploads: false,
            analytics: false,
            usuarios_basico: true,
            usuarios_acesso: false,
            configuracoes: false,
            audit_log: false,
            integracoes: false,
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

  it("admin edits only basic fields of non-owner users", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("heading", { name: "Colaborador" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Colaborador Editado" },
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
        name: "Colaborador Editado",
      });
      expect(payload).not.toHaveProperty("permissions");
      expect(payload).not.toHaveProperty("accessRole");
      expect(payload).not.toHaveProperty("status");
      expect(payload).not.toHaveProperty("roles");
      expect(payload).not.toHaveProperty("id");
    });
  });
});
