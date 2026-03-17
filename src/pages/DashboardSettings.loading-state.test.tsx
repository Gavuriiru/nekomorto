import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings } from "@/hooks/site-settings-context";
import DashboardSettings, { __testing } from "@/pages/DashboardSettings";

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

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
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

const deferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe("DashboardSettings loading state", () => {
  beforeEach(() => {
    __testing.clearDashboardSettingsCache();
    apiFetchMock.mockReset();
    refreshMock.mockClear();
  });

  it("renderiza shell e tabs antes de /api/settings responder", async () => {
    const settingsDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return settingsDeferred.promise;
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
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    expect(screen.getByRole("tab", { name: /SEO/i })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-settings-skeleton-surface")).toBeInTheDocument();

    settingsDeferred.resolve(mockJsonResponse(true, { settings: defaultSettings }));

    await screen.findByText("Nome do site");
  });

  it("destrava a pagina quando /api/settings responde, sem esperar metadados auxiliares", async () => {
    const translationsDeferred = deferredResponse();
    const projectsDeferred = deferredResponse();
    const linkTypesDeferred = deferredResponse();

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: defaultSettings });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return translationsDeferred.promise;
      }
      if (path === "/api/projects" && method === "GET") {
        return projectsDeferred.promise;
      }
      if (path === "/api/link-types" && method === "GET") {
        return linkTypesDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
        <DashboardSettings />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de ajustes/i });
    await screen.findByText("Nome do site");
    expect(screen.queryByTestId("dashboard-settings-skeleton-surface")).not.toBeInTheDocument();

    await act(async () => {
      translationsDeferred.resolve(
        mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} }),
      );
      projectsDeferred.resolve(mockJsonResponse(true, { projects: [] }));
      linkTypesDeferred.resolve(mockJsonResponse(true, { items: [] }));
    });
  });
});
