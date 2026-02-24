import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPages from "@/pages/DashboardPages";

const { apiFetchMock, navigateMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const setupApiMock = (preferences: unknown) => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
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
    if (path === "/api/pages" && method === "GET") {
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
    if (path === "/api/pages" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { pages?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { pages: payload.pages || {} });
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

describe("DashboardPages preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it("restaura aba salva em preferências na abertura da página", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.pages": {
          filters: {
            tab: "faq",
          },
        },
      },
    });

    render(<DashboardPages />);

    await screen.findByRole("heading", { name: /Gerenciar páginas/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "FAQ" })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("persiste troca de aba via /api/me/preferences", async () => {
    setupApiMock({ uiListState: {} });

    render(<DashboardPages />);

    await screen.findByRole("heading", { name: /Gerenciar páginas/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "FAQ" }));

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
    expect(payload.preferences?.uiListState?.["dashboard.pages"]?.filters?.tab).toBe("faq");
  });
});
