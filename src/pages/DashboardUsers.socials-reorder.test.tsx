import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUsers from "@/pages/DashboardUsers";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
}));

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

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const userFixture = {
  id: "user-1",
  name: "Admin",
  phrase: "",
  bio: "",
  avatarUrl: "/uploads/users/avatar-user-1.png",
  socials: [
    { label: "instagram", href: "https://instagram.com/admin" },
    { label: "discord", href: "https://discord.gg/admin" },
  ],
  status: "active" as const,
  permissions: ["*"],
  roles: [],
  order: 0,
};

describe("DashboardUsers socials reorder", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [userFixture],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, {
          items: [
            { id: "instagram", label: "Instagram", icon: "instagram" },
            { id: "discord", label: "Discord", icon: "message-circle" },
          ],
        });
      }
      if (path === "/api/users/user-1" && method === "PUT") {
        const payload = (options as { json?: Record<string, unknown> } | undefined)?.json || {};
        return mockJsonResponse(true, {
          user: {
            ...userFixture,
            ...payload,
            socials: (payload.socials as Array<{ label: string; href: string }>) || userFixture.socials,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("reordena redes via drag-and-drop e salva no payload em nova ordem", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    const openEditorButton = await screen.findByRole("button", { name: /Abrir usuario Admin/i });
    expect(screen.queryByRole("button", { name: /Editar usuario Admin/i })).not.toBeInTheDocument();
    fireEvent.click(openEditorButton);
    const dialog = await screen.findByRole("dialog");

    const dragHandle = within(dialog).getByRole("button", { name: /Arrastar rede discord/i });
    const dropTarget = within(dialog).getByTestId("user-social-row-0");
    expect(dropTarget.className).toContain("overflow-x-auto");
    const socialGrid = dropTarget.firstElementChild as HTMLElement;
    expect(socialGrid.className).toContain("grid-cols-[auto_auto_auto_minmax(0,1fr)_auto]");
    expect(socialGrid.className).not.toContain("min-w-[720px]");
    const socialSelectTrigger = within(dialog).getByRole("combobox", { name: "Instagram" });
    expect(socialSelectTrigger.className).toContain("w-14");
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(dropTarget, { dataTransfer });
    fireEvent.drop(dropTarget, { dataTransfer });
    fireEvent.dragEnd(dragHandle, { dataTransfer });

    const hrefInputs = within(dialog).getAllByPlaceholderText("https://");
    expect((hrefInputs[0] as HTMLInputElement).value).toBe("https://discord.gg/admin");

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === "/api/users/user-1" && method === "PUT";
      });
      expect(putCall).toBeTruthy();
      const payload = (putCall?.[2] as { json?: { socials?: Array<{ label: string; href: string }> } }).json;
      expect(payload?.socials?.[0]?.label).toBe("discord");
      expect(payload?.socials?.[0]?.href).toBe("https://discord.gg/admin");
    });
  });

  it("salva reordenação de cards com toast de sucesso", async () => {
    const alphaUser = {
      ...userFixture,
      id: "user-alpha",
      name: "Alpha",
      order: 0,
    };
    const betaUser = {
      ...userFixture,
      id: "user-beta",
      name: "Beta",
      order: 1,
    };
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [alphaUser, betaUser],
          ownerIds: ["user-alpha"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-alpha",
          name: "Alpha",
          username: "alpha",
          grants: { usuarios_acesso: true, usuarios_basico: true },
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/users/reorder" && method === "PUT") {
        return mockJsonResponse(true, { ok: true });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Mover usuario Beta para cima/i }));

    await waitFor(() => {
      const reorderCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === "/api/users/reorder" && method === "PUT";
      });
      expect(reorderCall).toBeTruthy();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Ordem dos usu/i),
        }),
      );
    });
  });

  it("restaura ordem anterior e mostra erro quando reordenação falha", async () => {
    const alphaUser = {
      ...userFixture,
      id: "user-alpha",
      name: "Alpha",
      order: 0,
    };
    const betaUser = {
      ...userFixture,
      id: "user-beta",
      name: "Beta",
      order: 1,
    };
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [alphaUser, betaUser],
          ownerIds: ["user-alpha"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-alpha",
          name: "Alpha",
          username: "alpha",
          grants: { usuarios_acesso: true, usuarios_basico: true },
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/users/reorder" && method === "PUT") {
        return mockJsonResponse(false, { error: "forbidden" }, 403);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Mover usuario Beta para cima/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/salvar a nova ordem/i),
          variant: "destructive",
        }),
      );
    });

    await waitFor(() => {
      const userHeadings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent || "");
      const alphaIndex = userHeadings.findIndex((text) => text.includes("Alpha"));
      const betaIndex = userHeadings.findIndex((text) => text.includes("Beta"));
      expect(alphaIndex).toBeGreaterThanOrEqual(0);
      expect(betaIndex).toBeGreaterThanOrEqual(0);
      expect(alphaIndex).toBeLessThan(betaIndex);
    });
  });
});
