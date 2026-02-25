import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings } from "@/hooks/site-settings-context";
import DashboardSettings from "@/pages/DashboardSettings";

const { apiFetchMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: defaultSettings,
    refresh: refreshMock,
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

const setupApiMock = ({ canManagePages }: { canManagePages: boolean }) => {
  apiFetchMock.mockReset();
  refreshMock.mockClear();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/settings" && method === "GET") {
      return mockJsonResponse(true, { settings: defaultSettings });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, {
        tags: {},
        genres: {},
        staffRoles: {},
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }
    if (path === "/api/pages" && method === "GET") {
      if (!canManagePages) {
        return mockJsonResponse(false, { error: "forbidden" }, 403);
      }
      return mockJsonResponse(true, {
        pages: {
          home: { shareImage: "" },
          projects: { shareImage: "" },
          about: { shareImage: "" },
          donations: { shareImage: "" },
          faq: { shareImage: "" },
          team: { shareImage: "" },
          recruitment: { shareImage: "" },
        },
      });
    }
    if (path === "/api/settings" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { settings?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { settings: payload.settings || defaultSettings });
    }
    if (path === "/api/tag-translations" && method === "PUT") {
      return mockJsonResponse(true, {
        tags: {},
        genres: {},
        staffRoles: {},
      });
    }
    if (path === "/api/link-types" && method === "PUT") {
      return mockJsonResponse(true, { items: [] });
    }
    if (path === "/api/pages" && method === "PUT") {
      return mockJsonResponse(true, { pages: {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
  });

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

describe("DashboardSettings query sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    refreshMock.mockClear();
  });

  it("aplica aba vinda de ?tab=", async () => {
    setupApiMock({ canManagePages: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=traducoes"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Tradu/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=traducoes");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("tab invalida cai para default e limpa a URL", async () => {
    setupApiMock({ canManagePages: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=invalida"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Geral/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("preview-paginas sem permissao cai no default e limpa a URL", async () => {
    setupApiMock({ canManagePages: false });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes?tab=preview-paginas"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /Preview/i })).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Geral/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("troca de aba atualiza ?tab= e aba default remove o parametro", async () => {
    setupApiMock({ canManagePages: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Tradu/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toContain("tab=traducoes");
    });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Geral/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    expect(getPreferenceCalls()).toHaveLength(0);
  });
});
