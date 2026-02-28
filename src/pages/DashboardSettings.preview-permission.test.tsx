import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("DashboardSettings sem preview de paginas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: defaultSettings });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/tag-translations/anilist-sync" && method === "POST") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("nao renderiza a aba Prévia e nao chama /api/pages", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: /Painel/i });

    const tablist = screen.getByRole("tablist");
    expect(within(tablist).queryByRole("tab", { name: /Prévia/i })).not.toBeInTheDocument();
    expect(apiFetchMock.mock.calls.some((call) => String(call[1] || "") === "/api/pages")).toBe(
      false,
    );
  });
});
