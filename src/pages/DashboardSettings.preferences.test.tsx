import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardSettings from "@/pages/DashboardSettings";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = ({
  preferences,
  canManagePages,
}: {
  preferences: unknown;
  canManagePages: boolean;
}) => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
  refreshMock.mockClear();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { preferences?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { preferences: payload.preferences || {} });
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

const getPreferencePutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/me/preferences" && method === "PUT";
  });

describe("DashboardSettings preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();
  });

  it("restaura aba salva quando a aba está disponível", async () => {
    setupApiMock({
      preferences: {
        uiListState: {
          "dashboard.settings": {
            filters: { tab: "traducoes" },
          },
        },
      },
      canManagePages: true,
    });

    render(<DashboardSettings />);

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Traduções/i })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("ignora aba salva sem permissão e mantém fallback seguro", async () => {
    setupApiMock({
      preferences: {
        uiListState: {
          "dashboard.settings": {
            filters: { tab: "preview-paginas" },
          },
        },
      },
      canManagePages: false,
    });

    render(<DashboardSettings />);

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    expect(screen.queryByRole("tab", { name: /Preview páginas/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Geral/i })).toHaveAttribute("aria-selected", "true");
  });

  it("persiste troca de aba em /api/me/preferences", async () => {
    setupApiMock({
      preferences: { uiListState: {} },
      canManagePages: true,
    });

    render(<DashboardSettings />);

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Traduções/i }));

    await waitFor(
      () => {
        expect(getPreferencePutCalls().length).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );

    const putCalls = getPreferencePutCalls();
    const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
      json?: { preferences?: unknown };
    });
    const payload =
      request.json ||
      JSON.parse(String(request.body || "{}"));
    expect(payload.preferences?.uiListState?.["dashboard.settings"]?.filters?.tab).toBe("traducoes");
  });
});
