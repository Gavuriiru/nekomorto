import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [
          {
            id: "user-1",
            name: "Admin",
            phrase: "",
            bio: "",
            avatarUrl: null,
            socials: [],
            status: "active",
            permissions: ["usuarios_basico", "usuarios_acesso"],
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
        id: "user-1",
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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

describe("DashboardUsers edit query", () => {
  it("abre criacao automaticamente com ?create=1 e limpa a query", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?create=1"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /adicionar usu.rio/i });
    expect(document.querySelector(".project-editor-dialog")).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("abre editor automaticamente com ?edit=me e limpa a query", async () => {
    setupApiMock();

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByText(/editar usu.rio/i);
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(document.documentElement).toHaveClass("editor-scroll-stable");
    expect(document.body).toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBe("1");
    expect(document.documentElement).toHaveClass("editor-scroll-locked");
    expect(document.body).toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBe("1");

    unmount();

    expect(document.documentElement).not.toHaveClass("editor-scroll-stable");
    expect(document.body).not.toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBeNull();
    expect(document.documentElement).not.toHaveClass("editor-scroll-locked");
    expect(document.body).not.toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBeNull();
  });

  it("controla classe editor-modal-scrolled no dialog ao rolar e fechar", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /editar usu.rio/i });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    const editorDialog = document.querySelector(".project-editor-dialog") as HTMLElement | null;
    const editorScrollShell = document.querySelector(
      ".project-editor-scroll-shell",
    ) as HTMLElement | null;
    const editorTop = document.querySelector(".project-editor-top") as HTMLElement | null;
    const editorFooter = document.querySelector(".project-editor-footer") as HTMLElement | null;
    const editorHeader = editorTop?.firstElementChild as HTMLElement | null;
    const editorStatusBar = editorTop?.lastElementChild as HTMLElement | null;
    const editorLayout = document.querySelector(".project-editor-layout") as HTMLElement | null;
    const editorSectionContent = document.querySelector(
      ".project-editor-section-content",
    ) as HTMLElement | null;
    const editorAccordion = document.querySelector(
      ".project-editor-accordion",
    ) as HTMLElement | null;
    expect(editorDialog).not.toBeNull();
    expect(editorScrollShell).not.toBeNull();
    expect(editorHeader).not.toBeNull();
    expect(editorStatusBar).not.toBeNull();
    expect(editorLayout).not.toBeNull();
    expect(editorSectionContent).not.toBeNull();
    expect(editorAccordion).not.toBeNull();
    expect(editorTop?.className).toContain("sticky");
    expect(editorFooter?.className).toContain("sticky");
    expect(document.querySelector(".project-editor-dialog-surface")).toBeNull();
    expect(editorScrollShell?.className).toContain("overflow-y-auto");
    expect(editorScrollShell?.className).not.toContain("max-h-[94vh]");
    expect(editorHeader?.className).toContain("pt-3.5");
    expect(editorHeader?.className).toContain("pb-2.5");
    expect(editorStatusBar?.className).toContain("py-1.5");
    expect(editorLayout?.className).toContain("gap-3.5");
    expect(editorLayout?.className).toContain("pt-2.5");
    expect(editorLayout?.className).toContain("pb-4");
    expect(editorFooter?.className).toContain("py-2");
    expect(editorFooter?.className).toContain("md:py-2.5");
    expect(editorSectionContent?.className).toContain("pb-2.5");
    expect(editorAccordion?.className).toContain("space-y-2.5");
    expect(editorDialog).not.toHaveClass("editor-modal-scrolled");

    if (!editorDialog || !editorScrollShell) {
      throw new Error("Editor dialog not found");
    }

    expect(editorDialog.contains(editorScrollShell)).toBe(true);

    editorScrollShell.scrollTop = 24;
    fireEvent.scroll(editorScrollShell);

    await waitFor(() => {
      expect(editorDialog).toHaveClass("editor-modal-scrolled");
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /editar usu.rio/i })).not.toBeInTheDocument();
    });
    expect(document.querySelector(".project-editor-dialog.editor-modal-scrolled")).toBeNull();
  });
});
